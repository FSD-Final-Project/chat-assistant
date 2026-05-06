# Vector Search & RAG Implementation Guide (Team 102)

This document provides the technical specifications for implementing **Thread-Based Semantic Chunking** and **Vector Search** within your existing RocketChat assistant project.

---

## 1. Prerequisites & Setup
* **Embedding Model:** OpenAI `text-embedding-3-small` (1536 dimensions).
* **Vector Database:** MongoDB Atlas Vector Search.
* **Similarity Metric:** Cosine Similarity.

### MongoDB Atlas Index Configuration
Log into Atlas and create a **Vector Search Index** on your `MessageChunks` collection with the following JSON:

```json
{
  "fields": [
    {
      "numDimensions": 1536,
      "path": "embedding",
      "similarity": "cosine",
      "type": "vector"
    }
  ]
}
```

---

## 2. Data Schema & Storage
Store messages as **Logical Chunks** (threads or groups) rather than individual records to preserve context and reduce noise.

**Collection:** `MessageChunks`
```javascript
{
  "chunk_id": "string",     // Unique identifier
  "tmid": "string",         // RocketChat Thread ID (if applicable)
  "messages": [             // Array of raw message objects
    { "user": "string", "text": "string", "timestamp": "ISO" }
  ],
  "start_time": "ISO",
  "end_time": "ISO",
  "embedding": [float],     // 1536-dimensional vector
  "summary": "string"       // Optional: Pre-generated chunk summary
}
```

---

## 3. Implementation Logic

### Step 1: Define "Logical Chunks"
* **Threaded:** Use the `tmid` from RocketChat to automatically group replies to a parent message.
* **Unthreaded:** Group messages by a **Time Gap** (e.g., if no new message arrives for 5 minutes, close the chunk).

### Step 2: Batch Embedding (Async)
Instead of embedding every webhook hit, wait for a chunk to "cool down" (close), then join all message text into one string and generate a single vector.

### Step 3: Hybrid Retrieval Query
When a user requests a summary or needs a suggested reply, use a hybrid query combining vector search (for facts) and time filters (for flow):

```javascript
[
  {
    "$vectorSearch": {
      "index": "vector_index",
      "path": "embedding",
      "queryVector": "<target_message_vector>",
      "numCandidates": 100,
      "limit": 5
    }
  },
  {
    "$lookup": {
      "from": "MessageChunks",
      "let": { "last_time": "$$NOW" },
      "pipeline": [
        { "$match": { "start_time": { "$gte": "<last_5_minutes>" } } }
      ],
      "as": "recent_context"
    }
  }
]
```

---

## 4. Key Benefits for Your Project
* **Cost Optimization:** Performs significantly fewer API calls compared to per-message embedding.
* **Higher Accuracy:** Avoids "Context Blindness" by ensuring vectors represent full decisions or topics.
* **Cleaner Summaries:** Thread-based retrieval provides a narrative flow for "Daily Briefings".