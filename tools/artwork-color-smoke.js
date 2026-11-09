// Run from the repository root: gjs tools/artwork-color-smoke.js
const {Gio, GLib, GdkPixbuf} = imports.gi;
const [, bytes] = Gio.File.new_for_path('extension.js').load_contents(null);
const source = new TextDecoder().decode(bytes);
const start = source.indexOf('function dominantArtworkColor(');
const end = source.indexOf('// Host 1:', start);
const functions = eval('(function () {' + source.slice(start, end) + '\nreturn [dominantArtworkColor, readableArtworkColor];})()');
const [dominant, readable] = functions;
const dominantArtworkColor = dominant;
function assert(condition, message) { if (!condition) throw Error(message); }
function image(rgba) {
    const pixbuf = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, true, 8, 8, 8);
    pixbuf.fill(rgba);
    return pixbuf;
}
assert(dominant(image(0xffffffff)) === null, 'neutral fallback');
assert(dominant(image(0xff000000)) === null, 'transparent fallback');
assert(dominant(image(0x101010ff)) === null, 'dark neutral fallback');
const red = dominant(image(0xe02020ff));
assert(red[0] > 0.8 && red[1] < 0.2, 'red icon keeps its hue');
const dark = readable([0.05, 0.2, 0.05], true);
assert(dark[1] > 0.6 && dark[1] > dark[0], 'dark green lifted for dark panel');
const bright = readable([1, 0.9, 0.1], false);
assert(bright[0] < 0.7 && bright[0] > bright[2], 'bright yellow darkened for light panel');
const methodStart = source.indexOf('    _loadArtworkColor(icon) {');
const methodEnd = source.indexOf('    _applyArtworkColor() {', methodStart);
const Harness = eval('class Test {' + source.slice(methodStart, methodEnd) + '\n_applyArtworkColor() {}\n}; Test;');
const loop = GLib.MainLoop.new(null, false);
const test = new Harness();
const path = GLib.get_current_dir() + '/tools/nested/nested-home/np-cover-wide.png';
const file = Gio.File.new_for_path(path);
const [ok, contents] = file.load_contents(null);
const icons = [new Gio.FileIcon({file}), new Gio.BytesIcon({bytes: new GLib.Bytes(contents)})];
let index = 0;
let ticks = 0;
let failure = null;
function next() {
    test._loadArtworkColor(icons[index]);
}
next();
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
    if (++ticks > 100) { failure = 'artwork decoding timed out'; loop.quit(); return GLib.SOURCE_REMOVE; }
    if (test._artworkColorLoad) return GLib.SOURCE_CONTINUE;
    if (!test._artworkColor) { failure = 'missing color for ' + index; loop.quit(); return GLib.SOURCE_REMOVE; }
    if (++index < icons.length) { next(); return GLib.SOURCE_CONTINUE; }
    test._loadArtworkColor(null);
    if (test._artworkColor !== null) failure = 'fallback did not clear tint';
    loop.quit();
    return GLib.SOURCE_REMOVE;
});
loop.run();
if (failure) throw Error(failure);
print('PASS: async file and inline thumbnail decoding; missing thumbnail clears tint');
