const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const pages = [
  "index.html",
  "about.html",
  "services.html",
  "events.html",
  "projects.html",
  "partners.html",
  "contact.html"
];
const directories = ["css", "js", "images"];

const copy = (source, destination) => {
  fs.cpSync(path.join(root, source), path.join(output, destination || source), {
    recursive: true
  });
};

for (const source of [...pages, ...directories, "_headers"]) {
  if (!fs.existsSync(path.join(root, source))) {
    throw new Error(`Required public source is missing: ${source}`);
  }
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const page of pages) {
  copy(page);
}

for (const directory of directories) {
  copy(directory);
}

copy("_headers");
console.log(`Built ${pages.length} pages into ${path.relative(root, output)}/`);
