// CommonJS => ES6
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const cheerio = require('cheerio');

export default cheerio;
