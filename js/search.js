// search.js

// Initialize Fuse instance
let fuse;

// Fuse.js options (tunable)
const fuseOptions = {
  includeScore: true,
  shouldSort: true,
  threshold: 0.3, // 0.0 = strict, 1.0 = very fuzzy
  distance: 100,  // tolerance for term distance
  keys: [
    { name: "type", weight: 0.1 },
    { name: "title", weight: 0.5 },
    { name: "content", weight: 0.3 },
    { name: "tags", weight: 0.1 }
  ]
};

// 🔍 Build search index from database
async function buildSearchIndex() {
  const notes = await db.notes.toArray();
  const tasks = await db.tasks.toArray();
  const events = await db.events.toArray();

  const flattened = [];

  for (const n of notes) {
    flattened.push({
      id: `note-${n.id}`,
      type: "Note",
      title: n.title || "",
      content: stripHTML(n.contentHTML || ""),
      tags: n.tags || []
    });
  }

  for (const t of tasks) {
    flattened.push({
      id: `task-${t.id}`,
      type: "Task",
      title: t.title || "",
      content: t.status || "",
      tags: t.tags || []
    });
  }

  for (const e of events) {
    flattened.push({
      id: `event-${e.id}`,
      type: "Event",
      title: e.title || "",
      content: e.description || "",
      tags: []
    });
  }

  // Clear existing index and replace
  await db.searchIndex.clear();
  await db.searchIndex.bulkAdd(flattened);

  fuse = new Fuse(flattened, fuseOptions);
  console.log("Search index rebuilt:", flattened.length, "items");
}

// 🔄 Incremental update (optional)
async function updateSearchIndex(itemType, item) {
  const record = {
    id: `${itemType}-${item.id}`,
    type: capitalize(itemType),
    title: item.title || "",
    content: item.contentHTML || item.description || item.status || "",
    tags: item.tags || []
  };
  await db.searchIndex.put(record);
  fuse.add(record);
}

// 🧹 Utility: strip HTML tags for clean text search
function stripHTML(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// Utility: capitalize type labels
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 🔎 Perform search query
async function searchAll(query) {
  if (!fuse) {
    const data = await db.searchIndex.toArray();
    fuse = new Fuse(data, fuseOptions);
  }

  const results = fuse.search(query);
  return results.map(r => r.item);
}

// Optional: listen to Dexie hooks for auto-indexing
db.notes.hook("creating", (primKey, obj) => updateSearchIndex("note", obj));
db.tasks.hook("creating", (primKey, obj) => updateSearchIndex("task", obj));
db.events.hook("creating", (primKey, obj) => updateSearchIndex("event", obj));
