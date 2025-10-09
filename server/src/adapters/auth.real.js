export const auth = {
  async signIn(email) {
    /* hand off to real SSO/Firebase custom token */ return {
      uid: "real_uid",
      email,
    };
  },
  async verify(req) {
    /* verify real JWT */ return null;
  },
};
