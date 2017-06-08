function parseBeatmap(beatmap) {
    let origLines = beatmap.split('\n');
    let lines = [];
    for (let i = 0; i < origLines.length; i++) {
        let line = origLines[i].trim();
        if (line.length == 0)
            continue;
        lines.push(line);
    }

    if (lines[0] != 'osu file format v14')
        throw 'unsupported file format: ' + lines[0];

    let sectionName = null;
    let sectionContent = null;
    let content = {};
    let isFirst = false;
    for (let i = 0; i < lines.length; i++) {
        let v = lines[i];
        let m = /^\[(.*)\]$/.exec(v);
        if (m) {
            if (sectionName !== null)
                content[sectionName] = sectionContent;
            sectionName = m[1];
            isFirst = true;
            continue;
        }
        switch (sectionName) {
        case 'General':
        case 'Editor':
        case 'Metadata':
        case 'Difficulty': {
            if (isFirst)
                sectionContent = {};
            let sp = v.split(':');
            let key = sp[0].trim();
            let value = Number(sp[1]);
            if (isNaN(value))
                value = sp[1].trim();
            sectionContent[key] = value;
            break;
        }
        case 'TimingPoints': {
            if (isFirst)
                sectionContent = [];
            let row = {};
            let cols = ['Offset', 'MillisecondsPerBeat', 'Meter', 'SampleType', 'SampleSet', 'Volume', 'Inherited', 'KiaiMode'];
            let sp = v.split(',');
            for (let j = 0; j < cols.length; j++)
                row[cols[j]] = Number(sp[j]);
            sectionContent.push(row);
            break;
        }
        case 'HitObjects': {
            if (isFirst)
                sectionContent = [];
            let sp = v.split(',');
            let type = Number(sp[3]);
            let row = {};
            if (type & 1) {
                let cols = ['X', 'Y', 'Time', 'Type', 'HitSound'];
                for (let j = 0; j < cols.length - 1; j++)
                    row[cols[j]] = Number(sp[j]);
                row.Type = 'hit object';
                row.Addition = sp[cols.length];
            } else if (type & 128) {
                let cols = ['X', 'Y', 'Time', 'Type', 'HitSound'];
                for (let j = 0; j < cols.length - 1; j++)
                    row[cols[j]] = Number(sp[j]);
                row.Type = 'hold note';
                let add = sp[cols.length].split(':');
                row.EndTime = Number(add[0]);
                row.Addition = add.slice(1).join(':');
            } else {
                throw "unknown hit object type";
            }
            sectionContent.push(row);
            break;
        }
        default:
            break;
        }
        isFirst = false;
    }
    content[sectionName] = sectionContent;
    return content;
}

function makeTimingIndex(timingPoints, songLength) {
    if (timingPoints[0].Inherited !== 1)
        throw "first timing point cannot be inherited";

    let speed = [1.0];
    // extend the first timing point to the beginning
    let position = [0];
    let offset = [0];
    let songMillisPerBeat = timingPoints[0].MillisecondsPerBeat;
    let baseMillisPerBeat = songMillisPerBeat;
    let millisPerBeat = songMillisPerBeat;
    let curPos = timingPoints[0].Offset;
    for (let i = 1; i < timingPoints.length; i++) {
        let a = timingPoints[i-1];
        let b = timingPoints[i];
        // for some reason 0 means inherited timing point
        if (b.Inherited === 0)
            millisPerBeat = inheritedMillisPerBeat(baseMillisPerBeat, b.MillisecondsPerBeat);
        else
            millisPerBeat = baseMillisPerBeat = b.MillisecondsPerBeat;
        curPos += (b.Offset - a.Offset) * speed[i - 1];
        speed.push(songMillisPerBeat / millisPerBeat);
        position.push(curPos);
        offset.push(b.Offset);
    }
    // make a fake timing point for the end of the song
    position.push(curPos + (songLength - timingPoints[timingPoints.length - 1].Offset) * speed[speed.length - 1]);
    speed.push(1.0);
    offset.push(songLength);
    return {speed, position, offset};
}

function computeOffsetIndex(offset, index) {
    let begin = 0, end = index.offset.length - 1;
    let mid;
    // find index of offset <= to desired offset
    while (begin <= end) {
        mid = Math.floor((begin + end) / 2);
        if (index.offset[mid] > offset) {
            // everything >= mid is invalid
            end = mid - 1;
        } else if (index.offset[mid] < offset) {
            // everything < mid is invalid
            // check if mid works
            if (index.offset[mid + 1] > offset)
                break;
            // now everything <= mid is invalid
            begin = mid + 1;
        } else {
            break;
        }
    }
    if (index.offset[mid] > offset || (mid < index.offset.length - 1 && index.offset[mid] < index.offset[mid + 1] && index.offset[mid + 1] <= offset))
        throw "bug in bsearch!";
    return mid;
}

function computePosition(offset, index) {
    if (offset < index.offset[0])
        return index.position[0] + index.speed[0] * (offset - index.offset[0]);
    let i = computeOffsetIndex(offset, index);
    return index.position[i] + index.speed[i] * (offset - index.offset[i]);
}

function computeNotePositions(hitObjects, index) {
    let start = [], end = [];
    for (let isEnd = 0; isEnd < 2; isEnd++) {
        for (let h = 0; h < hitObjects.length; h++) {
            let obj = hitObjects[h];
            let time = obj.Time;
            if (isEnd === 1 && obj.Type == 'hold note')
                time = obj.EndTime;
            let pos = computePosition(time, index);
            if (isEnd === 0)
                start.push(pos);
            else
                end.push(pos);
        }
    }
    return {start, end};
}

function inheritedMillisPerBeat(baseMillisPerBeat, inheritedValue) {
    return -inheritedValue * baseMillisPerBeat / 100.0;
}

export {parseBeatmap, makeTimingIndex, computePosition, computeNotePositions}
