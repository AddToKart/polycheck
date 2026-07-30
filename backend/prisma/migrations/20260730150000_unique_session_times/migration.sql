-- Prevent concurrent single/bulk creation from producing duplicate meetings.
CREATE UNIQUE INDEX "Session_sectionId_date_startTime_endTime_key"
ON "Session"("sectionId", "date", "startTime", "endTime");
