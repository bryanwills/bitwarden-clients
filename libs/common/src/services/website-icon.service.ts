import { Utils } from "../platform/misc/utils";
import { CipherType } from "../vault/enums/cipher-type";
import { CipherView } from "../vault/models/view/cipher.view";

export type WebsiteIconData = {
  imageEnabled: boolean;
  image: string;
  fallbackImage: string;
  icon: string;
};

// TODO: Make a decision later as whether we want to use this or not. We could scope and optimize the behavior for use in the overlay specifically.
class WebsiteIconService {
  static buildCipherIconData(
    iconsServerUrl: string,
    cipher: CipherView,
    isFaviconDisabled: boolean
  ) {
    // TODO: Not sure about having this here.
    if (!iconsServerUrl || isFaviconDisabled) {
      return null;
    }

    const imageEnabled = !isFaviconDisabled;
    let icon;
    let image;
    let fallbackImage = "";
    const cardIcons: Record<string, string> = {
      Visa: "card-visa",
      Mastercard: "card-mastercard",
      Amex: "card-amex",
      Discover: "card-discover",
      "Diners Club": "card-diners-club",
      JCB: "card-jcb",
      Maestro: "card-maestro",
      UnionPay: "card-union-pay",
      RuPay: "card-ru-pay",
    };

    switch (cipher.type) {
      case CipherType.Login:
        icon = "bwi-globe";

        if (cipher.login.uri) {
          let hostnameUri = cipher.login.uri;
          let isWebsite = false;

          if (hostnameUri.indexOf("androidapp://") === 0) {
            icon = "bwi-android";
            image = null;
          } else if (hostnameUri.indexOf("iosapp://") === 0) {
            icon = "bwi-apple";
            image = null;
          } else if (
            imageEnabled &&
            hostnameUri.indexOf("://") === -1 &&
            hostnameUri.indexOf(".") > -1
          ) {
            hostnameUri = `http://${hostnameUri}`;
            isWebsite = true;
          } else if (imageEnabled) {
            isWebsite = hostnameUri.indexOf("http") === 0 && hostnameUri.indexOf(".") > -1;
          }

          if (imageEnabled && isWebsite) {
            try {
              image = `${iconsServerUrl}/${Utils.getHostname(hostnameUri)}/icon.png`;
              fallbackImage = "images/bwi-globe.png";
            } catch (e) {
              // Ignore error since the fallback icon will be shown if image is null.
            }
          }
        } else {
          image = null;
        }
        break;
      case CipherType.SecureNote:
        icon = "bwi-sticky-note";
        break;
      case CipherType.Card:
        icon = "bwi-credit-card";
        if (imageEnabled && cipher.card.brand in cardIcons) {
          icon = `credit-card-icon ${cardIcons[cipher.card.brand]}`;
        }
        break;
      case CipherType.Identity:
        icon = "bwi-id-card";
        break;
      default:
        break;
    }

    return {
      imageEnabled,
      image,
      fallbackImage,
      icon,
    };
  }
}

export { WebsiteIconService };
