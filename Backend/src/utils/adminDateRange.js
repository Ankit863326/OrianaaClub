const indiaOffset = '+05:30';

function boundary(value, endOfDay) {
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  return new Date(`${value}T${time}${indiaOffset}`);
}

export default function adminDateRange(from, to, field = 'createdAt') {
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = boundary(from, false);
  if (to) range.$lte = boundary(to, true);
  return { [field]: range };
}
