const yaml = require("js-yaml");

const MANAGED_KEYS = new Set(["nownote_id", "nownote_kind", "nownote_schema", "title", "tags"]);
const KINDS = new Set(["topic", "category", "note"]);

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function metadata(id, kind, schema, title, tags) {
  if (typeof id !== "string" || !id.trim()) throw new Error("Invalid Vault metadata: nownote_id");
  if (!KINDS.has(kind)) throw new Error("Invalid Vault metadata: nownote_kind");
  if (schema !== 1) throw new Error("Unsupported Vault metadata schema");
  if (typeof title !== "string") throw new Error("Invalid Vault metadata: title");
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
    throw new Error("Invalid Vault metadata: tags");
  }
  return { id, kind, schema, title, tags };
}

function parseManagedMarkdown(text) {
  const source = String(text);
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) return null;
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) throw new Error("Invalid Vault frontmatter boundary");
  let fields;
  try {
    fields = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
  } catch (error) {
    throw new Error(`Invalid Vault frontmatter: ${error.message}`);
  }
  if (!plainObject(fields)) throw new Error("Invalid Vault frontmatter mapping");
  if (!["nownote_id", "nownote_kind", "nownote_schema"].some((key) => Object.hasOwn(fields, key))) return null;
  const managed = metadata(fields.nownote_id, fields.nownote_kind, fields.nownote_schema, fields.title ?? "", fields.tags ?? []);
  const extraFrontmatter = Object.fromEntries(Object.entries(fields).filter(([key]) => !MANAGED_KEYS.has(key)));
  return { metadata: managed, body: source.slice(match[0].length), extraFrontmatter };
}

function renderManagedMarkdown({ id, kind, title, body, tags = [], extraFrontmatter = {} }) {
  const managed = metadata(id, kind, 1, title, tags);
  if (typeof body !== "string") throw new Error("Invalid Vault Markdown body");
  if (body.trimStart().startsWith("NOW_ENCRYPTED_V1:")) throw new Error("Encrypted note cannot be exported to Vault");
  if (!plainObject(extraFrontmatter)) throw new Error("Invalid Vault extra frontmatter");
  for (const key of Object.keys(extraFrontmatter)) {
    if (MANAGED_KEYS.has(key)) throw new Error(`Vault extra frontmatter overrides ${key}`);
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error(`Unsafe Vault frontmatter key: ${key}`);
  }
  const fields = {
    ...extraFrontmatter,
    nownote_id: managed.id,
    nownote_kind: managed.kind,
    nownote_schema: managed.schema,
    title: managed.title,
    tags: managed.tags,
  };
  const newline = body.includes("\r\n") ? "\r\n" : "\n";
  const header = yaml.dump(fields, { schema: yaml.JSON_SCHEMA, lineWidth: -1, noRefs: true }).trimEnd().replace(/\n/g, newline);
  return `---${newline}${header}${newline}---${newline}${body}`;
}

module.exports = { parseManagedMarkdown, renderManagedMarkdown };
