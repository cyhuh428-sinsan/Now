const test = require("node:test");
const assert = require("node:assert/strict");
const { parseManagedMarkdown, renderManagedMarkdown } = require("../vault-markdown.cjs");

test("topic and category index files retain identity with an empty body", () => {
  for (const kind of ["topic", "category"]) {
    const markdown = renderManagedMarkdown({ id: `${kind}-1`, kind, title: "빈 분류", body: "", tags: [] });
    assert.match(markdown, /^---\n/);
    assert.deepEqual(parseManagedMarkdown(markdown), {
      metadata: { id: `${kind}-1`, kind, schema: 1, title: "빈 분류", tags: [] },
      body: "",
      extraFrontmatter: {},
    });
  }
});

test("note Markdown round-trips Korean, CRLF, links, tags, and unknown Obsidian keys", () => {
  const body = "첫 줄\r\n[[다른 메모]]와 [링크](https://example.com/a:b)\r\n마지막 줄\r\n";
  const extraFrontmatter = { aliases: ["별칭: 하나"], cssclasses: ["wide"], custom: { nested: true } };
  const markdown = renderManagedMarkdown({
    id: "note-1", kind: "note", title: "제목: 한글", body, tags: ["업무", "긴 메모"], extraFrontmatter,
  });
  assert.deepEqual(parseManagedMarkdown(markdown), {
    metadata: { id: "note-1", kind: "note", schema: 1, title: "제목: 한글", tags: ["업무", "긴 메모"] },
    body,
    extraFrontmatter,
  });
});

test("unmarked Markdown stays unlinked and a partially marked file is rejected", () => {
  assert.equal(parseManagedMarkdown("---\naliases: [old]\n---\nExisting index\n"), null);
  assert.equal(parseManagedMarkdown("# Plain Markdown\n"), null);
  assert.throws(() => parseManagedMarkdown("---\nnownote_id: abc\n---\nBody\n"), /metadata|frontmatter/i);
});

test("invalid metadata and managed-key overrides are rejected", () => {
  assert.throws(() => parseManagedMarkdown("---\nnownote_id: n1\nnownote_kind: note\nnownote_schema: 2\n---\nBody\n"), /schema/i);
  assert.throws(() => renderManagedMarkdown({ id: "x", kind: "folder", title: "x", body: "" }), /kind/i);
  assert.throws(() => renderManagedMarkdown({
    id: "x", kind: "note", title: "x", body: "", extraFrontmatter: { nownote_id: "other" },
  }), /nownote_id/i);
  for (const unsafe of ["__proto__", "constructor", "prototype"]) {
    assert.throws(() => renderManagedMarkdown({ id: unsafe, kind: "note", title: "x", body: "" }), /nownote_id/i);
    assert.throws(() => parseManagedMarkdown(`---\nnownote_id: ${unsafe}\nnownote_kind: note\nnownote_schema: 1\n---\n`), /nownote_id/i);
  }
});

test("encrypted note contents cannot be rendered into a Vault file", () => {
  assert.throws(() => renderManagedMarkdown({
    id: "secret", kind: "note", title: "private", body: "NOW_ENCRYPTED_V1:payload",
  }), /encrypted|암호화/i);
});
