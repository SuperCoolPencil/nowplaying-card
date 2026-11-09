// Run from the repository root: gjs tools/ribbon-smoke.js
const {Gio} = imports.gi;
const [, bytes] = Gio.File.new_for_path('extension.js').load_contents(null);
const source = new TextDecoder().decode(bytes);
const constants = source.slice(source.indexOf('const WAVES ='), source.indexOf('// How long the waves'));
const sampler = source.slice(source.indexOf('function sampleRibbonGradient('), source.indexOf('const RIBBON_BUS'));
const methods = source.slice(source.indexOf('    _ribbonHalf('), source.indexOf('    // Stop burning frames'));
const Harness = eval('(function () {' + constants + sampler + '\nreturn class Test {' + methods + '};})()');
function assert(condition, message) { if (!condition) throw Error(message); }
const icon = new Harness();
Object.assign(icon, {
    mapped: true, _playing: true, _animated: true, _iconStyle: 'spectrum', _shape: 'ribbon',
    width: 64, height: 16, _levels: Array(16).fill(1), _drift: 0,
    _artworkColor: [0.2, 0.8, 0.4],
    get_theme_node: () => ({get_foreground_color: () => ({red: 255, green: 255, blue: 255, alpha: 255})}),
    get_parent: () => ({get_theme_node: () => ({get_foreground_color: () => ({red: 255, green: 255, blue: 255})})}),
    _waveLifts: () => Array.from({length: 3}, () => icon._levels),
});
const frame = icon.ribbonFrame();
assert(frame.active && frame.rgb.length === 4, 'four active left-to-right zones');
assert(frame.rgb.every(rgb => rgb.length === 3 && rgb.every(v => Number.isInteger(v) && v >= 0 && v <= 255)), 'valid RGB channels');
assert(frame.rgb.every(rgb => rgb[1] > rgb[0]), 'zones share the green thumbnail palette');
const quiet = {...frame, rgb: null};
icon._levels.fill(0);
quiet.rgb = icon.ribbonFrame().rgb;
assert(quiet.rgb.flat().reduce((a, b) => a + b, 0) < frame.rgb.flat().reduce((a, b) => a + b, 0), 'zones swell with the ribbon');
icon._playing = false;
assert(!icon.ribbonFrame().active && icon.ribbonFrame().rgb.flat().every(v => v === 0), 'pause turns keyboard dark');
icon._playing = true;
icon._shape = 'waves';
assert(!icon.ribbonFrame().active, 'only the ribbon publishes active frames');
print('PASS: shared thumbnail gradient, ribbon geometry, four-zone mapping, pause and shape gating');
