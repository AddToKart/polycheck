-- Record the teacher who created a parent subject so it remains visible before any section is added.
ALTER TABLE "Subject" ADD COLUMN "createdById" TEXT;

CREATE INDEX "Subject_createdById_idx" ON "Subject"("createdById");

ALTER TABLE "Subject"
ADD CONSTRAINT "Subject_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
