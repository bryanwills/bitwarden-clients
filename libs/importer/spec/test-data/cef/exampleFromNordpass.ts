import { CredentialExchangeFormat } from "../../../src/importers/cef/types/cef-importer-types";

const nordpassExample: CredentialExchangeFormat = {
  version: 0,
  exporter: "NordPass",
  timestamp: 1711526471900000,
  accounts: [
    {
      id: "181,38,97,101,157,46,184,237",
      userName: "username@gmail.com",
      email: "username@gmail.com",
      collections: [
        {
          id: "112,196,235,107,56,184,65,239",
          title: "2Passwords",
          items: [
            {
              id: "222,179,189,207,131,82,171,80",
              creationAt: 1709279117,
              modifiedAt: 1709279117,
              type: "login",
              title: "Login minimal",
              credentials: [
                {
                  type: "basic-auth",
                  urls: [],
                  username: {
                    id: "163,113,167,124,110,179,220,244",
                    fieldType: "text",
                    value: "",
                    label: "Username",
                  },
                  password: {
                    id: "188,103,178,102,195,129,80,160",
                    fieldType: "password",
                    value: "",
                    label: "Password",
                  },
                },
              ],
            },
            {
              id: "201,18,123,172,231,231,176,43",
              creationAt: 1709279117,
              modifiedAt: 1709279117,
              type: "login",
              title: "Login with all custom fields",
              credentials: [
                {
                  type: "basic-auth",
                  urls: [
                    "https://custom.website.com",
                    "https://another.website.com",
                    "https://another",
                  ],
                  username: {
                    id: "142,77,101,233,56,72,225,23",
                    fieldType: "text",
                    value: "",
                    label: "Username",
                  },
                  password: {
                    id: "184,168,234,83,28,246,2,53",
                    fieldType: "password",
                    value: "",
                    label: "Password",
                  },
                },
              ],
            },
          ],
        },
      ],
      items: [
        {
          id: "141,125,108,181,161,77,221,67",
          creationAt: 1710755527,
          modifiedAt: 1710755527,
          type: "login",
          title: "passkeys.io",
          credentials: [
            {
              type: "passkey",
              credentialId: "5,118,198,186,199,43,147,228",
              rpId: "www.passkeys.io",
              userName: "wrong@email.com",
              userDisplayName: "",
              userHandle: "",
              key: {
                CoseKey:
                  "pgECAyYgASFYIP6iIen16POjtGroSJ+Qh9OmBUezMG2DAx3pLTa3bIOpIlggjxS3dNeWIy3sfFH8Yu2M/AOv5jy5oP3UiuSSfPaqTH0jWCBHxRWAKLl48xmjMo0AJK2S4mPIxHW6KsKFd2vwiFX40A==",
              },
            },
          ],
        },
        {
          id: "213,80,125,188,192,94,59,85",
          creationAt: 1709279117,
          modifiedAt: 1709279117,
          type: "login",
          title: "Login full",
          credentials: [
            {
              type: "basic-auth",
              urls: ["https://website.com"],
              username: {
                id: "230,186,128,165,122,226,85,62",
                fieldType: "text",
                value: "Email or username",
                label: "Username",
              },
              password: {
                id: "129,94,46,96,192,246,89,57",
                fieldType: "password",
                value: "password",
                label: "Password",
              },
            },
          ],
        },
      ],
    },
  ],
};
export const nordpassExampleString = JSON.stringify(nordpassExample);
