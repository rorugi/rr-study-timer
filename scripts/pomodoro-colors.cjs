const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public/pomodoro-tomato-comic-final.svg'), 'utf8');
const colors = [...fs.readFileSync(path.join(root, 'src/pomodoro_colors.ts'), 'utf8').matchAll(/\['([a-z]+)', '[^']+', '(#[a-f0-9]+)'\]/g)];
const body = source.match(/<path\b(?=[^>]*\bid="path74")[^>]*\/>/);
if (!body || !body[0].includes('fill:#f92015') || colors.length !== 9) throw Error('Unexpected tomato body layer or palette');
const output = path.join(root, 'public/pomodoro-colors');
fs.mkdirSync(output, {recursive:true});
for (const [, name, color] of colors) {
  fs.writeFileSync(path.join(output, `${name}.svg`), source.replace(body[0], body[0].replace('fill:#f92015', `fill:${color}`)));
}
