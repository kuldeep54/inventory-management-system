export function extractError(err) {
  if (!err.response?.data) return "Something went wrong. Please try again.";
  const detail = err.response.data.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || d.message).join(". ");
  }
  return "Something went wrong. Please try again.";
}
