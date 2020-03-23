import { withPluginApi } from "discourse/lib/plugin-api";
import discourseComputed, { observes } from "discourse-common/utils/decorators";
import { computed } from "@ember/object";
import { setting } from "discourse/lib/computed";

import Category from "discourse/models/category";
import CategoryList from "discourse/models/category-list";
import CategoriesAdminDropdown from "select-kit/components/categories-admin-dropdown";
import showModal from "discourse/lib/show-modal";

import { userPath } from "discourse/lib/url";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

function initializeHideCategories(api) {
  api.modifyClass("model:user", {
    @discourseComputed("custom_fields.hidden_category_ids")
    hidden_category_ids() {
      let items = this.get("custom_fields.hidden_category_ids");
      if (!items || !items.length || items == "-1") return [];
      else if (typeof(items) === "string") return [items];
      return items;
    },

    @observes("custom_fields.hidden_category_ids")
    updateHiddenCategories() {
      const list = Category.list();
      list.forEach(c => c.set("isHidden", false));
      this.set("hiddenCategories", Category.findByIds(this.hidden_category_ids));
      this.hiddenCategories.forEach(c => c.set("isHidden", true));
    }
  });

  let user = api.getCurrentUser();
  if (user) {
    user.findDetails();
    user.addObserver("custom_fields.hidden_category_ids");
  }

  api.modifyClass("controller:preferences/categories", {
    actions: {
      save() {
        let actual = this.model.hiddenCategories.map(category => category.id);

        // hack to ensure empty categories list gets saved
        let tmp = actual;
        if (!tmp || !tmp.length) {
          tmp = [-1];
        }

        this.model.set("custom_fields.hidden_category_ids", tmp);
        const data = this.currentUser.getProperties(["custom_fields"]);

        ajax(userPath(`${this.currentUser.username_lower}.json`), {
          data: data,
          type: "PUT"
        }).then(() => this._super(...arguments))
          .catch(popupAjaxError);

        this.model.set("custom_fields.hidden_category_ids", actual);
      }
    }
  });

  api.modifyClass("route:discovery-categories", {
    setupController(controller, model) {
      controller.set("model", model);

      this.controllerFor("navigation/categories").setProperties({
        showCategoryDropdown: user,
        showCategoryAdmin: model.get("can_create_category"),
        canCreateTopic: model.get("can_create_topic")
      });
    },

    actions: {
      hideCategories() {
        showModal("hideCategories");
      }
    }
  });

  api.modifyClass("component:d-navigation", {
    actions: {
      selectCategoryAdminDropdownAction(actionId) {
        switch (actionId) {
          case "hide":
            this.hideCategories();
            break;
          case "create":
            this.createCategory();
            break;
          case "reorder":
            this.reorderCategories();
            break;
        }
      }
    }
  });

  CategoriesAdminDropdown.reopen( {
    content: computed(function() {
      const items = [
        {
          id: "hide",
          name: I18n.t("categories.hide.title"),
          description: I18n.t("categories.hide.title_long"),
          icon: "far-eye-slash",
        }
      ];

      if (this.showCategoryAdmin) items.push(...this._super());

      return items;
    })
  });
}

export default {
  name: "discourse-hide-categories",

  initialize(container) {
    const siteSettings = container.lookup("site-settings:main");
    if (siteSettings.discourse_hide_categories_enabled)
      withPluginApi("0.8.16", initializeHideCategories);
  }
};
