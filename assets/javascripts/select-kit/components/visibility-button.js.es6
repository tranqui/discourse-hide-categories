import DropdownSelectBoxComponent from "select-kit/components/dropdown-select-box";
import { allLevels, buttonDetails } from "discourse/lib/visibility-levels";
import { computed, setProperties } from "@ember/object";

export default DropdownSelectBoxComponent.extend({
  pluginApiIdentifiers: ["visibility-button"],
  classNames: ["visibility-button"],
  content: allLevels,
  nameProperty: "key",

  selectKitOptions: {
    autoFilterable: false,
    filterable: false,
    i18nPrefix: "",
    i18nPostfix: ""
  },

  modifyComponentForRow() {
    return "visibility-button/visibility-button-row";
  },

  modifySelection(content) {
    content = content || {};
    const { i18nPrefix, i18nPostfix } = this.selectKit.options;
    setProperties(content, {
      label: I18n.t(
        `${i18nPrefix}.${this.buttonForValue.key}${i18nPostfix}.title`
      ),
      icon: this.buttonForValue.icon
    });
    return content;
  },

  buttonForValue: computed("value", function() {
    return buttonDetails(this.value);
  })
});
