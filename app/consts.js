const skin = {
    dirs: ['left', 'up', 'down', 'right'],
    judgementHeight: 24,
    timingNames: ["300g", "300", "200", "100", "50", "0"],
    loader: skinLoader
};

const consts = {
    width: 1200,
    height: 800,
    leftMargin: 200,
    keyWidth: 100,
    noteHeight: 100,
    keys: 4,
    keyMap: ['D', 'F', 'J', 'K'],
    timingBase: [16, 64, 97, 127, 151, 188], // first is perfect, last is early miss
    timingDifficulty: 3,
    timingAccPoints: [300, 300, 200, 100, 50, 0],
    leadTime: 2000,
    trailTime: 2000,
    baseScrollSpeed: 1.5, // in pixels per millisecond
    hitTweenScaleMax: 1.05,
    hitTweenScaleMin: 0.9,
    hitTweenUpTime: 50,
    hitTweenDownTime: 150,
    skin: skin
};

function skinLoader(load) {
    for (let i = 0; i < skin.dirs.length; i++) {
        let dir = skin.dirs[i];
        load.image('key_up/' + i, 'skin/arrows/key_' + dir + '.png');
        load.image('key_down/' + i, 'skin/arrows/key_' + dir + 'D.png');
        load.image('note/' + i, 'skin/arrownote/' + dir + '.png');
    }
    for (let i = 0; i < skin.timingNames.length; i++) {
        load.image('hit/' + i, 'skin/mania-hit' + skin.timingNames[i] + '.png');
    }
}

export {consts};
