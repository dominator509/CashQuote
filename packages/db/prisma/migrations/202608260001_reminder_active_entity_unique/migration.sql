-- Prevent concurrent active reminders for the same business entity.
-- Resolved reminders release the entity for a future reminder.
CREATE UNIQUE INDEX "Reminder_active_entity_unique"
ON "Reminder"("businessId", "entityType", "entityId")
WHERE "status" IN ('pending', 'sending', 'sent');
