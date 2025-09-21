import { YAMLReader, Exporter } from "../src"

new Exporter(YAMLReader.readFile('./test.yaml', { debug: false })).export('png', { name: 'iotest', saveAsFile: true })