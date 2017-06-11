global.PIXI = require('pixi.js');
global.p2 = require('p2');
global.Phaser = require('phaser');
let {consts} = require('./consts');
let {parseBeatmap, makeTimingIndex, computePosition, computeNotePositions} = require('./beatmap');
let {computeScoreTimings} = require('./scoring');

class GameState {
    constructor() {
        this.game = null;

        this.keyState = [];
        this.keyUp = [];
        this.keyDown = [];

        this.timingIndex = null;
        this.scoreTimings = null;

        this.time = -consts.leadTime;
        this.audio = null;
        this.audioStartTime = 0;

        this.hits = [];
        this.hitObjectsByColumn = [];
        this.curObjectByColumn = [];
        this.visibleHit = null;
        this.visibleHitTween = null;

        this.accScore = 0;
        this.maxAccScore = 0;
        this.accText = null;

        this.combo = 0;
        this.comboText = null;
    }

    preload() {
        let game = this.game;
        let load = game.load;
        load.text('beatmap', 'songs/shelter/loneliness.osu');
        load.audio('audio', 'songs/shelter/shelter.mp3');
        load.image('background', 'songs/shelter/normal.jpg');
        consts.skin.loader(load);
        let kb = game.input.keyboard;
        for (let i = 0; i < consts.keyMap.length; i++) {
            let key = kb.addKey(Phaser.KeyCode[consts.keyMap[i]]);
            let j = i;
            key.onDown.add((sig) => this.handleKey(key, j, true));
            key.onUp.add((sig) => this.handleKey(key, j, false));
        }
        game.time.advancedTiming = true;
    }

    /** world looks like this:
     *
     * current issues: trailing time is wrong if last timing point has different bpm
     *
     *  --------------------- Y = 0
     *
     *   trailing time
     *
     *  --------------------- Y = trail time * base scroll speed (last note also goes here) + judgement height
     *
     *   note                 Y = (last note pos + trail time - note pos) * base scroll speed + judgement height = firstNotY - note pos * base scroll speed
     *
     *  -song t = 0---------- Y = (last note pos + trail time) * base scroll speed + judgement height = firstNoteY
     *
     *    leading time
     *
     *  ---------------------
     *    padding for judgement height
     *  --------------------- Y = (lead time + last note pos + trail time) * base scroll speed + judgement height = maxY
     *
     */

    createStaticGraphics() {
        let background = this.game.add.image(0, 0, 'background');
        background.height = consts.height;
        background.centerX = consts.width / 2;
        background.centerY = consts.height / 2;
        background.fixedToCamera = true;

        let graphics = this.game.add.graphics(0, 0);
        graphics.fixedToCamera = true;
        graphics.beginFill(0x000000, 0.7);
        graphics.drawRect(consts.leftMargin, 0, consts.keyWidth * consts.keys, consts.height);
    }

    createButtons() {
        for (let i = 0; i < consts.keys; i++) {
            let up = this.game.add.image(this.keyX(i), 0, 'key_up/' + i);
            up.width = consts.keyWidth;
            up.fixedToCamera = true;
            this.keyUp.push(up);

            let down = this.game.add.image(this.keyX(i), 0, 'key_down/' + i);
            down.width = consts.keyWidth;
            down.fixedToCamera = true;
            down.visible = false;
            this.keyDown.push(down);
        }
    }

    createBeatmap() {
        let beatmap = parseBeatmap(this.game.cache.getText('beatmap'));
        let timingPoints = beatmap.TimingPoints;
        let hitObjects = beatmap.HitObjects;
        // XXX: this is not using the right length!! note that it is wrong with hold notes
        this.timingIndex = makeTimingIndex(timingPoints, hitObjects[hitObjects.length - 1].Time);
        let {start, end} = computeNotePositions(hitObjects, this.timingIndex);
        let maxY = (consts.leadTime + start[start.length - 1] + consts.trailTime) * consts.baseScrollSpeed + consts.skin.judgementHeight;
        let firstNoteY = (start[start.length - 1] + consts.trailTime) * consts.baseScrollSpeed;
        for (let i = 0; i < consts.keys; i++) {
            let col = [];
            for (let j = 0; j < hitObjects.length; j++) {
                let obj = hitObjects[j];
                if (i !== Math.floor(obj.X / 128))
                    continue;
                let y = firstNoteY - start[j] * consts.baseScrollSpeed;
                let note = this.game.add.image(this.keyX(i), y, 'note/' + i);
                note.width = consts.keyWidth;
                note.height = consts.noteHeight;
                note.anchor.y = 1;
                obj.note = note;
                col.push(obj);
            }
            this.hitObjectsByColumn.push(col);
            this.curObjectByColumn.push(0);
        }
        this.game.world.bounds.height = maxY;
        this.game.camera.setBoundsToWorld();
        this.scoreTimings = computeScoreTimings(beatmap.Difficulty.OverallDifficulty);
    }

    createScoreboard() {
        for (let i = 0; i < this.scoreTimings.length; i++) {
            let hit = this.game.add.image(consts.leftMargin + consts.keyWidth * consts.keys * 0.5, consts.height / 2 + 40, 'hit/' + i);
            hit.anchor.x = 0.5;
            hit.anchor.y = 0.5;
            hit.fixedToCamera = true;
            hit.visible = false;
            this.hits.push(hit);
        }

        var style = { font: "50px Consolas", fill: "#ffffff", align: "center" };
        this.accText = this.game.add.text(consts.width - 30, 30, '100.00%', style);
        this.accText.anchor.x = 1.0;
        this.accText.fixedToCamera = true;
        this.accText.shadowFill = true;
        this.accText.shadowBlur = 10;
        this.accText.shadowColor = 'rgba(0, 0, 0, 1)';

        style = { font: "70px Consolas", fill: "#cccccc", align: "center" };
        this.comboText = this.game.add.text(consts.leftMargin + consts.keyWidth * consts.keys * 0.5, consts.height / 2 - 40, '0', style);
        this.comboText.anchor.x = 0.5;
        this.comboText.anchor.y = 0.5;
        this.comboText.fixedToCamera = true;
        this.comboText.shadowFill = true;
        this.comboText.shadowBlur = 10;
        this.comboText.shadowColor = 'rgba(0, 0, 0, 1)';
    }

    create() {
        this.audio = this.game.add.audio('audio');
        this.createStaticGraphics();
        this.createBeatmap();
        this.createButtons();
        this.createScoreboard();

        this.game.onPause.add(() => this.audio.stop());

        this.xx = 0;
    }

    update() {
        let game = this.game;
        this.time = this.time + game.time.physicsElapsedMS;
        // prefer audio time
        if (this.audio.isPlaying)
            this.time = this.audioStartTime + this.audio.currentTime;
        let pos = computePosition(this.time, this.timingIndex);
        game.camera.y = game.world.bounds.height - consts.height - (pos + consts.leadTime) * consts.baseScrollSpeed;

        if (!this.audio.isPlaying && this.time >= 0) {
            this.audio.play('', this.time / 1000.0);
            this.audioStartTime = this.time;
        }

        this.checkLateMisses();

        if (this.xx >= 60) {
            this.xx = 0;
            console.log(game.time.fps);
        }
        this.xx++;
    }

    handleKey(key, idx, down) {
        if (this.keyState[idx] == down)
            return;
        this.keyState[idx] = down;
        if (down) {
            this.keyUp[idx].visible = false;
            this.keyDown[idx].visible = true;
        } else {
            this.keyDown[idx].visible = false;
            this.keyUp[idx].visible = true;
        }
        this.score(idx, this.keyState[idx]);
    }

    score(idx, down) {
        if (!this.audio.isPlaying || this.curObjectByColumn[idx] >= this.hitObjectsByColumn[idx].length)
            return;
        let time = this.audioStartTime + this.audio.currentTime;
        this.checkLateMissColumn(idx, time);
        let obj = this.hitObjectsByColumn[idx][this.curObjectByColumn[idx]];
        let objTime = obj.Time;
        let tm = this.scoreTimings;
        if (time < objTime - tm[tm.length - 1])
            return;
        for (let i = tm.length - 1; i > 0; i--) {
            if (time < objTime - tm[i - 1]) {
                this.curObjectByColumn[idx]++;
                this.updateHit(obj, i);
                return;
            }
        }
        for (let i = 0; i < tm.length - 1; i++) {
            if (time <= objTime + tm[i]) {
                this.curObjectByColumn[idx]++;
                this.updateHit(obj, i);
                return;
            }
        }
    }

    checkLateMisses() {
        for (let i = 0; i < consts.keys; i++) {
            this.checkLateMissColumn(i, this.time);
        }
    }

    checkLateMissColumn(i, time) {
        let lateMiss = this.scoreTimings[this.scoreTimings.length - 2];
        while (this.curObjectByColumn[i] < this.hitObjectsByColumn[i].length &&
            time > this.hitObjectsByColumn[i][this.curObjectByColumn[i]].Time + lateMiss) {
            this.updateHit(this.hitObjectsByColumn[i][this.curObjectByColumn[i]], this.scoreTimings.length - 1);
            this.curObjectByColumn[i]++;
        }
    }

    updateHit(obj, hitIdx) {
        if (hitIdx == this.scoreTimings.length - 1) {
            // miss
            this.combo = 0;
        } else {
            // hit
            obj.note.visible = false;
            this.combo++;
        }
        if (this.visibleHit != null) {
            this.visibleHit.visible = false;
            this.visibleHitTween.stop();
            this.visibleHit = null;
            this.visibleHitTween = null;
        }
        this.visibleHit = this.hits[hitIdx];
        this.visibleHit.scale.x = 1.0;
        this.visibleHit.scale.y = 1.0;
        this.visibleHit.visible = true;
        this.visibleHitTween = this.game.add.tween(this.visibleHit.scale)
            .to({x: consts.hitTweenScaleMax, y: consts.hitTweenScaleMax}, consts.hitTweenUpTime)
            .to({x: consts.hitTweenScaleMin, y: consts.hitTweenScaleMin}, consts.hitTweenDownTime);
        this.visibleHitTween.start();
        this.visibleHitTween.onComplete.add(() => {
            this.visibleHit.visible = false;
            this.visibleHit = null;
            this.visibleHitTween = null;
        });
        this.accScore += consts.timingAccPoints[hitIdx];
        this.maxAccScore += consts.timingAccPoints[0];
        this.accText.text = Number(Math.round(this.accScore / this.maxAccScore * 10000) / 100).toFixed(2) + '%';
        this.comboText.text = String(this.combo);
    }

    keyX(idx) {
        return consts.leftMargin + idx * consts.keyWidth;
    }
}

function main() {
    let game = new GameState();
    let state = new Phaser.State();
    state.preload = () => game.preload();
    state.create = () => game.create();
    state.update = () => game.update();
    game.game = new Phaser.Game(consts.width, consts.height, Phaser.AUTO, '', state);
}

main();
