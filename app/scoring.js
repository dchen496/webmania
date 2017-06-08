let {consts} = require('./consts');

function computeScoreTimings(od) {
    let timings = consts.timingBase.slice();
    for (let i = 1; i < consts.timingBase.length; i++)
        timings[i] -= consts.timingDifficulty * od;
    return timings;
}

export {computeScoreTimings}
