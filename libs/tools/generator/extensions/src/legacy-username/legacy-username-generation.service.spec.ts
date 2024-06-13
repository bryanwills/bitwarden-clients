import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import {
  ApiOptions,
  EmailDomainOptions,
  EmailPrefixOptions,
  SelfHostedApiOptions,
  GeneratorService,
  NoPolicy,
  CatchallGenerationOptions,
  DefaultCatchallOptions,
  DefaultEffUsernameOptions,
  EffUsernameGenerationOptions,
  DefaultAddyIoOptions,
  DefaultDuckDuckGoOptions,
  DefaultFastmailOptions,
  DefaultFirefoxRelayOptions,
  DefaultForwardEmailOptions,
  DefaultSimpleLoginOptions,
  Forwarders,
  DefaultSubaddressOptions,
  SubaddressGenerationOptions,
  policies,
} from "@bitwarden/generator-core";

import { mockAccountServiceWith } from "../../../../../common/spec";
import {
  GeneratorNavigationPolicy,
  GeneratorNavigationEvaluator,
  DefaultGeneratorNavigation,
  GeneratorNavigation,
  GeneratorNavigationService,
} from "../navigation";

import { LegacyUsernameGenerationService } from "./legacy-username-generation.service";
import { UsernameGeneratorOptions } from "./username-generation-options";

const DefaultPolicyEvaluator = policies.DefaultPolicyEvaluator;

const SomeUser = "userId" as UserId;

function createGenerator<Options>(options: Options, defaults: Options) {
  let savedOptions = options;
  const generator = mock<GeneratorService<Options, NoPolicy>>({
    evaluator$(id: UserId) {
      const evaluator = new DefaultPolicyEvaluator<Options>();
      return of(evaluator);
    },
    options$(id: UserId) {
      return of(savedOptions);
    },
    defaults$(id: UserId) {
      return of(defaults);
    },
    saveOptions: jest.fn((userId, options) => {
      savedOptions = options;
      return Promise.resolve();
    }),
  });

  return generator;
}

function createNavigationGenerator(
  options: GeneratorNavigation = {},
  policy: GeneratorNavigationPolicy = {},
) {
  let savedOptions = options;
  const generator = mock<GeneratorNavigationService>({
    evaluator$(id: UserId) {
      const evaluator = new GeneratorNavigationEvaluator(policy);
      return of(evaluator);
    },
    options$(id: UserId) {
      return of(savedOptions);
    },
    defaults$(id: UserId) {
      return of(DefaultGeneratorNavigation);
    },
    saveOptions: jest.fn((userId, options) => {
      savedOptions = options;
      return Promise.resolve();
    }),
  });

  return generator;
}

describe("LegacyUsernameGenerationService", () => {
  // NOTE: in all tests, `null` constructor arguments are not used by the test.
  // They're set to `null` to avoid setting up unnecessary mocks.
  describe("generateUserName", () => {
    it("should generate a catchall username", async () => {
      const options = { type: "catchall" } as UsernameGeneratorOptions;
      const catchall = createGenerator<CatchallGenerationOptions>(null, null);
      catchall.generate.mockResolvedValue("catchall@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        catchall,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      );

      const result = await generator.generateUsername(options);

      expect(catchall.generate).toHaveBeenCalledWith(options);
      expect(result).toBe("catchall@example.com");
    });

    it("should generate an EFF word username", async () => {
      const options = { type: "word" } as UsernameGeneratorOptions;
      const effWord = createGenerator<EffUsernameGenerationOptions>(null, null);
      effWord.generate.mockResolvedValue("eff word");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        effWord,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      );

      const result = await generator.generateUsername(options);

      expect(effWord.generate).toHaveBeenCalledWith(options);
      expect(result).toBe("eff word");
    });

    it("should generate a subaddress username", async () => {
      const options = { type: "subaddress" } as UsernameGeneratorOptions;
      const subaddress = createGenerator<SubaddressGenerationOptions>(null, null);
      subaddress.generate.mockResolvedValue("subaddress@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        null,
        subaddress,
        null,
        null,
        null,
        null,
        null,
        null,
      );

      const result = await generator.generateUsername(options);

      expect(subaddress.generate).toHaveBeenCalledWith(options);
      expect(result).toBe("subaddress@example.com");
    });

    it("should generate a forwarder username", async () => {
      // set up an arbitrary forwarder for the username test; all forwarders tested in their own tests
      const options = {
        type: "forwarded",
        forwardedService: Forwarders.AddyIo.id,
      } as UsernameGeneratorOptions;
      const addyIo = createGenerator<SelfHostedApiOptions & EmailDomainOptions>(null, null);
      addyIo.generate.mockResolvedValue("addyio@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        null,
        null,
        addyIo,
        null,
        null,
        null,
        null,
        null,
      );

      const result = await generator.generateUsername(options);

      expect(addyIo.generate).toHaveBeenCalledWith({});
      expect(result).toBe("addyio@example.com");
    });
  });

  describe("generateCatchall", () => {
    it("should generate a catchall username", async () => {
      const options = { type: "catchall" } as UsernameGeneratorOptions;
      const catchall = createGenerator<CatchallGenerationOptions>(null, null);
      catchall.generate.mockResolvedValue("catchall@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        catchall,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      );

      const result = await generator.generateCatchall(options);

      expect(catchall.generate).toHaveBeenCalledWith(options);
      expect(result).toBe("catchall@example.com");
    });
  });

  describe("generateSubaddress", () => {
    it("should generate a subaddress username", async () => {
      const options = { type: "subaddress" } as UsernameGeneratorOptions;
      const subaddress = createGenerator<SubaddressGenerationOptions>(null, null);
      subaddress.generate.mockResolvedValue("subaddress@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        null,
        subaddress,
        null,
        null,
        null,
        null,
        null,
        null,
      );

      const result = await generator.generateSubaddress(options);

      expect(subaddress.generate).toHaveBeenCalledWith(options);
      expect(result).toBe("subaddress@example.com");
    });
  });

  describe("generateForwarded", () => {
    it("should generate a AddyIo username", async () => {
      const options = {
        forwardedService: Forwarders.AddyIo.id,
        forwardedAnonAddyApiToken: "token",
        forwardedAnonAddyBaseUrl: "https://example.com",
        forwardedAnonAddyDomain: "example.com",
        website: "example.com",
      } as UsernameGeneratorOptions;
      const addyIo = createGenerator<SelfHostedApiOptions & EmailDomainOptions>(null, null);
      addyIo.generate.mockResolvedValue("addyio@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        null,
        null,
        addyIo,
        null,
        null,
        null,
        null,
        null,
      );

      const result = await generator.generateForwarded(options);

      expect(addyIo.generate).toHaveBeenCalledWith({
        token: "token",
        baseUrl: "https://example.com",
        domain: "example.com",
        website: "example.com",
      });
      expect(result).toBe("addyio@example.com");
    });

    it("should generate a DuckDuckGo username", async () => {
      const options = {
        forwardedService: Forwarders.DuckDuckGo.id,
        forwardedDuckDuckGoToken: "token",
        website: "example.com",
      } as UsernameGeneratorOptions;
      const duckDuckGo = createGenerator<ApiOptions>(null, null);
      duckDuckGo.generate.mockResolvedValue("ddg@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        null,
        null,
        null,
        duckDuckGo,
        null,
        null,
        null,
        null,
      );

      const result = await generator.generateForwarded(options);

      expect(duckDuckGo.generate).toHaveBeenCalledWith({
        token: "token",
        website: "example.com",
      });
      expect(result).toBe("ddg@example.com");
    });

    it("should generate a Fastmail username", async () => {
      const options = {
        forwardedService: Forwarders.Fastmail.id,
        forwardedFastmailApiToken: "token",
        website: "example.com",
      } as UsernameGeneratorOptions;
      const fastmail = createGenerator<ApiOptions & EmailPrefixOptions>(null, null);
      fastmail.generate.mockResolvedValue("fastmail@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        fastmail,
        null,
        null,
        null,
      );

      const result = await generator.generateForwarded(options);

      expect(fastmail.generate).toHaveBeenCalledWith({
        token: "token",
        website: "example.com",
      });
      expect(result).toBe("fastmail@example.com");
    });

    it("should generate a FirefoxRelay username", async () => {
      const options = {
        forwardedService: Forwarders.FirefoxRelay.id,
        forwardedFirefoxApiToken: "token",
        website: "example.com",
      } as UsernameGeneratorOptions;
      const firefoxRelay = createGenerator<ApiOptions>(null, null);
      firefoxRelay.generate.mockResolvedValue("firefoxrelay@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        firefoxRelay,
        null,
        null,
      );

      const result = await generator.generateForwarded(options);

      expect(firefoxRelay.generate).toHaveBeenCalledWith({
        token: "token",
        website: "example.com",
      });
      expect(result).toBe("firefoxrelay@example.com");
    });

    it("should generate a ForwardEmail username", async () => {
      const options = {
        forwardedService: Forwarders.ForwardEmail.id,
        forwardedForwardEmailApiToken: "token",
        forwardedForwardEmailDomain: "example.com",
        website: "example.com",
      } as UsernameGeneratorOptions;
      const forwardEmail = createGenerator<ApiOptions & EmailDomainOptions>(null, null);
      forwardEmail.generate.mockResolvedValue("forwardemail@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        forwardEmail,
        null,
      );

      const result = await generator.generateForwarded(options);

      expect(forwardEmail.generate).toHaveBeenCalledWith({
        token: "token",
        domain: "example.com",
        website: "example.com",
      });
      expect(result).toBe("forwardemail@example.com");
    });

    it("should generate a SimpleLogin username", async () => {
      const options = {
        forwardedService: Forwarders.SimpleLogin.id,
        forwardedSimpleLoginApiKey: "token",
        forwardedSimpleLoginBaseUrl: "https://example.com",
        website: "example.com",
      } as UsernameGeneratorOptions;
      const simpleLogin = createGenerator<SelfHostedApiOptions>(null, null);
      simpleLogin.generate.mockResolvedValue("simplelogin@example.com");
      const generator = new LegacyUsernameGenerationService(
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        simpleLogin,
      );

      const result = await generator.generateForwarded(options);

      expect(simpleLogin.generate).toHaveBeenCalledWith({
        token: "token",
        baseUrl: "https://example.com",
        website: "example.com",
      });
      expect(result).toBe("simplelogin@example.com");
    });
  });

  describe("getOptions", () => {
    it("combines options from its inner generators", async () => {
      const account = mockAccountServiceWith(SomeUser);

      const navigation = createNavigationGenerator({
        type: "username",
        username: "catchall",
        forwarder: Forwarders.AddyIo.id,
      });

      const catchall = createGenerator<CatchallGenerationOptions>(
        {
          catchallDomain: "example.com",
          catchallType: "random",
          website: null,
        },
        null,
      );

      const effUsername = createGenerator<EffUsernameGenerationOptions>(
        {
          wordCapitalize: true,
          wordIncludeNumber: false,
          website: null,
        },
        null,
      );

      const subaddress = createGenerator<SubaddressGenerationOptions>(
        {
          subaddressType: "random",
          subaddressEmail: "foo@example.com",
          website: null,
        },
        null,
      );

      const addyIo = createGenerator<SelfHostedApiOptions & EmailDomainOptions>(
        {
          token: "addyIoToken",
          domain: "addyio.example.com",
          baseUrl: "https://addyio.api.example.com",
          website: null,
        },
        null,
      );

      const duckDuckGo = createGenerator<ApiOptions>(
        {
          token: "ddgToken",
          website: null,
        },
        null,
      );

      const fastmail = createGenerator<ApiOptions & EmailPrefixOptions>(
        {
          token: "fastmailToken",
          domain: "fastmail.example.com",
          prefix: "foo",
          website: null,
        },
        null,
      );

      const firefoxRelay = createGenerator<ApiOptions>(
        {
          token: "firefoxToken",
          website: null,
        },
        null,
      );

      const forwardEmail = createGenerator<ApiOptions & EmailDomainOptions>(
        {
          token: "forwardEmailToken",
          domain: "example.com",
          website: null,
        },
        null,
      );

      const simpleLogin = createGenerator<SelfHostedApiOptions>(
        {
          token: "simpleLoginToken",
          baseUrl: "https://simplelogin.api.example.com",
          website: null,
        },
        null,
      );

      const generator = new LegacyUsernameGenerationService(
        account,
        navigation,
        catchall,
        effUsername,
        subaddress,
        addyIo,
        duckDuckGo,
        fastmail,
        firefoxRelay,
        forwardEmail,
        simpleLogin,
      );

      const result = await generator.getOptions();

      expect(result).toEqual({
        type: "catchall",
        wordCapitalize: true,
        wordIncludeNumber: false,
        subaddressType: "random",
        subaddressEmail: "foo@example.com",
        catchallType: "random",
        catchallDomain: "example.com",
        forwardedService: Forwarders.AddyIo.id,
        forwardedAnonAddyApiToken: "addyIoToken",
        forwardedAnonAddyDomain: "addyio.example.com",
        forwardedAnonAddyBaseUrl: "https://addyio.api.example.com",
        forwardedDuckDuckGoToken: "ddgToken",
        forwardedFirefoxApiToken: "firefoxToken",
        forwardedFastmailApiToken: "fastmailToken",
        forwardedForwardEmailApiToken: "forwardEmailToken",
        forwardedForwardEmailDomain: "example.com",
        forwardedSimpleLoginApiKey: "simpleLoginToken",
        forwardedSimpleLoginBaseUrl: "https://simplelogin.api.example.com",
      });
    });

    it("sets default options when an inner service lacks a value", async () => {
      const account = mockAccountServiceWith(SomeUser);
      const navigation = createNavigationGenerator(null);
      const catchall = createGenerator<CatchallGenerationOptions>(null, DefaultCatchallOptions);
      const effUsername = createGenerator<EffUsernameGenerationOptions>(
        null,
        DefaultEffUsernameOptions,
      );
      const subaddress = createGenerator<SubaddressGenerationOptions>(
        null,
        DefaultSubaddressOptions,
      );
      const addyIo = createGenerator<SelfHostedApiOptions & EmailDomainOptions>(
        null,
        DefaultAddyIoOptions,
      );
      const duckDuckGo = createGenerator<ApiOptions>(null, DefaultDuckDuckGoOptions);
      const fastmail = createGenerator<ApiOptions & EmailPrefixOptions>(
        null,
        DefaultFastmailOptions,
      );
      const firefoxRelay = createGenerator<ApiOptions>(null, DefaultFirefoxRelayOptions);
      const forwardEmail = createGenerator<ApiOptions & EmailDomainOptions>(
        null,
        DefaultForwardEmailOptions,
      );
      const simpleLogin = createGenerator<SelfHostedApiOptions>(null, DefaultSimpleLoginOptions);

      const generator = new LegacyUsernameGenerationService(
        account,
        navigation,
        catchall,
        effUsername,
        subaddress,
        addyIo,
        duckDuckGo,
        fastmail,
        firefoxRelay,
        forwardEmail,
        simpleLogin,
      );

      const result = await generator.getOptions();

      expect(result).toEqual({
        type: DefaultGeneratorNavigation.username,
        catchallType: DefaultCatchallOptions.catchallType,
        catchallDomain: DefaultCatchallOptions.catchallDomain,
        wordCapitalize: DefaultEffUsernameOptions.wordCapitalize,
        wordIncludeNumber: DefaultEffUsernameOptions.wordIncludeNumber,
        subaddressType: DefaultSubaddressOptions.subaddressType,
        subaddressEmail: DefaultSubaddressOptions.subaddressEmail,
        forwardedService: DefaultGeneratorNavigation.forwarder,
        forwardedAnonAddyApiToken: DefaultAddyIoOptions.token,
        forwardedAnonAddyDomain: DefaultAddyIoOptions.domain,
        forwardedAnonAddyBaseUrl: DefaultAddyIoOptions.baseUrl,
        forwardedDuckDuckGoToken: DefaultDuckDuckGoOptions.token,
        forwardedFastmailApiToken: DefaultFastmailOptions.token,
        forwardedFirefoxApiToken: DefaultFirefoxRelayOptions.token,
        forwardedForwardEmailApiToken: DefaultForwardEmailOptions.token,
        forwardedForwardEmailDomain: DefaultForwardEmailOptions.domain,
        forwardedSimpleLoginApiKey: DefaultSimpleLoginOptions.token,
        forwardedSimpleLoginBaseUrl: DefaultSimpleLoginOptions.baseUrl,
      });
    });
  });

  describe("saveOptions", () => {
    it("saves option sets to its inner generators", async () => {
      const account = mockAccountServiceWith(SomeUser);
      const navigation = createNavigationGenerator({ type: "password" });
      const catchall = createGenerator<CatchallGenerationOptions>(null, null);
      const effUsername = createGenerator<EffUsernameGenerationOptions>(null, null);
      const subaddress = createGenerator<SubaddressGenerationOptions>(null, null);
      const addyIo = createGenerator<SelfHostedApiOptions & EmailDomainOptions>(null, null);
      const duckDuckGo = createGenerator<ApiOptions>(null, null);
      const fastmail = createGenerator<ApiOptions & EmailPrefixOptions>(null, null);
      const firefoxRelay = createGenerator<ApiOptions>(null, null);
      const forwardEmail = createGenerator<ApiOptions & EmailDomainOptions>(null, null);
      const simpleLogin = createGenerator<SelfHostedApiOptions>(null, null);

      const generator = new LegacyUsernameGenerationService(
        account,
        navigation,
        catchall,
        effUsername,
        subaddress,
        addyIo,
        duckDuckGo,
        fastmail,
        firefoxRelay,
        forwardEmail,
        simpleLogin,
      );

      await generator.saveOptions({
        type: "catchall",
        wordCapitalize: true,
        wordIncludeNumber: false,
        subaddressType: "random",
        subaddressEmail: "foo@example.com",
        catchallType: "random",
        catchallDomain: "example.com",
        forwardedService: Forwarders.AddyIo.id,
        forwardedAnonAddyApiToken: "addyIoToken",
        forwardedAnonAddyDomain: "addyio.example.com",
        forwardedAnonAddyBaseUrl: "https://addyio.api.example.com",
        forwardedDuckDuckGoToken: "ddgToken",
        forwardedFirefoxApiToken: "firefoxToken",
        forwardedFastmailApiToken: "fastmailToken",
        forwardedForwardEmailApiToken: "forwardEmailToken",
        forwardedForwardEmailDomain: "example.com",
        forwardedSimpleLoginApiKey: "simpleLoginToken",
        forwardedSimpleLoginBaseUrl: "https://simplelogin.api.example.com",
        website: null,
      });

      expect(navigation.saveOptions).toHaveBeenCalledWith(SomeUser, {
        type: "password",
        username: "catchall",
        forwarder: Forwarders.AddyIo.id,
      });

      expect(catchall.saveOptions).toHaveBeenCalledWith(SomeUser, {
        catchallDomain: "example.com",
        catchallType: "random",
        website: null,
      });

      expect(effUsername.saveOptions).toHaveBeenCalledWith(SomeUser, {
        wordCapitalize: true,
        wordIncludeNumber: false,
        website: null,
      });

      expect(subaddress.saveOptions).toHaveBeenCalledWith(SomeUser, {
        subaddressType: "random",
        subaddressEmail: "foo@example.com",
        website: null,
      });

      expect(addyIo.saveOptions).toHaveBeenCalledWith(SomeUser, {
        token: "addyIoToken",
        domain: "addyio.example.com",
        baseUrl: "https://addyio.api.example.com",
        website: null,
      });

      expect(duckDuckGo.saveOptions).toHaveBeenCalledWith(SomeUser, {
        token: "ddgToken",
        website: null,
      });

      expect(fastmail.saveOptions).toHaveBeenCalledWith(SomeUser, {
        token: "fastmailToken",
        website: null,
      });

      expect(firefoxRelay.saveOptions).toHaveBeenCalledWith(SomeUser, {
        token: "firefoxToken",
        website: null,
      });

      expect(forwardEmail.saveOptions).toHaveBeenCalledWith(SomeUser, {
        token: "forwardEmailToken",
        domain: "example.com",
        website: null,
      });

      expect(simpleLogin.saveOptions).toHaveBeenCalledWith(SomeUser, {
        token: "simpleLoginToken",
        baseUrl: "https://simplelogin.api.example.com",
        website: null,
      });
    });
  });
});
