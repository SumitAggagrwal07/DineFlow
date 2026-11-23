// Small helpers so route files do not need to know room names.
const staffRoom = (restaurantId) => `rest:${restaurantId}`;
const orderRoom = (accessToken) => `order:${accessToken}`;
const menuRoom = (slug) => `menu:${slug}`;
const tableRoom = (slug, table) => `table:${slug}:${table}`;

function emitOrder(io, order, event = 'order:update') {
  if (!io) return;
  const doc = order.toObject ? order.toObject() : order;
  io.to(staffRoom(doc.restaurant)).emit(event, doc);
  io.to(orderRoom(doc.accessToken)).emit('order:update', doc);
}

function emitCall(io, call, event) {
  if (!io) return;
  const doc = call.toObject ? call.toObject() : call;
  io.to(staffRoom(doc.restaurant)).emit(event, doc);
}

module.exports = { staffRoom, orderRoom, menuRoom, tableRoom, emitOrder, emitCall };
