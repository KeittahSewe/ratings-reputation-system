// Ids in this database are UUIDs. Checking the shape first turns a bad id into
// a 404 instead of a database error.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
