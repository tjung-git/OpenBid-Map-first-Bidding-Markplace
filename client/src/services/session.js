let _user = null;
export function setUser(u) {
  _user = u;
}
export function getUser() {
  return _user;
}
export function logout() {
  localStorage.removeItem("mockUid");
  _user = null;
}
