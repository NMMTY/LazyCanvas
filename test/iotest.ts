import { JSONReader, Exporter } from "../src"

new Exporter(JSONReader.readFile('./test.json', { debug: true })).export('png', { name: 'iotest', saveAsFile: true })