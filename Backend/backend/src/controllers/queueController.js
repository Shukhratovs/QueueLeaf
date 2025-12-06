import * as queueService from "../services/queueService.js";

export async function getQueues(req, res) {
  try {
    const queues = await queueService.getAllQueues();
    res.json(queues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createQueue(req, res) {
  try {
    const { name, avgServiceSec } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const newQueue = await queueService.createQueue({
      name,
      avgServiceSec: Number(avgServiceSec) || 300,
      isOpen: true,
    });

    res.status(201).json(newQueue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function toggleQueue(req, res) {
  try {
    const { id } = req.params;
    const updated = await queueService.toggleQueue(id);
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

export async function updateMessage(req, res) {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const updated = await queueService.updateMessage(id, message);
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}
