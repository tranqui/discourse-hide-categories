import { or } from "@ember/object/computed";
import VisibilityOptionsComponent from "select-kit/components/visibility-button";

export default VisibilityOptionsComponent.extend({
  pluginApiIdentifiers: ["category-visibility-button"],
  classNames: ["category-visibility-button"],
  isHidden: or("category.deleted"),

  selectKitOptions: {
    i18nPrefix: "i18nPrefix",
    showFullTitle: false
  },

  i18nPrefix: "category.visibility"
});
