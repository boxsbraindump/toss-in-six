import { cast, formatChart, summarize, tossHexagram } from '../src/index.js';

const question = process.argv[2] ?? '测试：近期财运如何？';
const values = tossHexagram();
const result = cast(values, new Date(), { question });

console.log(`爻值（初→上）：${values.join(' ')}`);
console.log(summarize(result));
console.log();
console.log(formatChart(result));
