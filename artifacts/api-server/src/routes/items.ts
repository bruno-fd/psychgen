import { Router, type IRouter } from "express";
import { db, itemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetItemParams, UpdateItemParams, UpdateItemBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/items/:id", async (req, res) => {
  const { id } = GetItemParams.parse(req.params);
  const item = await db.query.itemsTable.findFirst({
    where: eq(itemsTable.id, id),
  });
  if (!item) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }
  res.json(item);
});

router.patch("/items/:id", async (req, res) => {
  const { id } = UpdateItemParams.parse(req.params);
  const body = UpdateItemBody.parse(req.body);
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) updates[k] = v;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nenhum campo para atualizar" });
    return;
  }
  const result = await db
    .update(itemsTable)
    .set(updates)
    .where(eq(itemsTable.id, id))
    .returning();
  if (result.length === 0) {
    res.status(404).json({ error: "Item não encontrado" });
    return;
  }
  res.json(result[0]);
});

export default router;
