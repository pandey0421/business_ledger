import fs from 'fs';
const json = JSON.parse(fs.readFileSync('openapi-response.json', 'utf8'));
if (json.definitions) {
    console.log("Definitions keys:", Object.keys(json.definitions));
} else if (json.components && json.components.schemas) {
    console.log("Component Schema keys:", Object.keys(json.components.schemas));
} else {
    console.log("Top level keys:", Object.keys(json));
}
