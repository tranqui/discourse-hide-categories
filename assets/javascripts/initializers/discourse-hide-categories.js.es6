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

import Site from "discourse/models/site";

import { get } from "@ember/object";
import { registerUnbound } from "discourse-common/lib/helpers";
import { isRTL } from "discourse/lib/text-direction";
import { iconHTML } from "discourse-common/lib/icon-library";
import categoryBadgeHTML from "discourse/helpers/category-link"

let escapeExpression = Handlebars.Utils.escapeExpression;

function categoryStripe(color, classes) {
  var style = color ? "style='background-color: #" + color + ";'" : "";
  return "<span class='" + classes + "' " + style + "></span>";
}

function buildTopicCount(count) {
  return `<span class="topic-count" aria-label="${I18n.t(
    "category_row.topic_count",
    { count }
  )}">&times; ${count}</span>`;
}

function newCategoryLinkRenderer(category, opts) {
  let descriptionText = get(category, "description_text");
  let restricted = get(category, "read_restricted");
  let show_restricted_icon = restricted;
  if (get(category, "suppress_restricted_icon") === true)
    show_restricted_icon = false;
  let url = opts.url
    ? opts.url
    : Discourse.getURL(
        `/c/${Category.slugFor(category)}/${get(category, "id")}`
      );
  let href = opts.link === false ? "" : url;
  let tagName = opts.link === false || opts.link === "false" ? "span" : "a";
  let extraClasses = opts.extraClasses ? " " + opts.extraClasses : "";
  let color = get(category, "color");
  let html = "";
  let parentCat = null;
  let categoryDir = "";

  if (!opts.hideParent) {
    parentCat = Category.findById(get(category, "parent_category_id"));
  }

  const categoryStyle =
    opts.categoryStyle || Discourse.SiteSettings.category_style;
  if (categoryStyle !== "none") {
    if (parentCat && parentCat !== category) {
      html += categoryStripe(
        get(parentCat, "color"),
        "badge-category-parent-bg"
      );
    }
    html += categoryStripe(color, "badge-category-bg");
  }

  let classNames = "badge-category clear-badge";
  if (restricted) {
    classNames += " restricted";
  }

  let style = "";
  if (categoryStyle === "box") {
    style = `style="color: #${get(category, "text_color")};"`;
  }

  html +=
    `<span ${style} ` +
    'data-drop-close="true" class="' +
    classNames +
    '"' +
    (descriptionText ? 'title="' + descriptionText + '" ' : "") +
    ">";

  let categoryName = escapeExpression(get(category, "name"));

  if (Discourse.SiteSettings.support_mixed_text_direction) {
    categoryDir = isRTL(categoryName) ? 'dir="rtl"' : 'dir="ltr"';
  }

  if (show_restricted_icon) {
    let lockIcon = Discourse.SiteSettings.discourse_hide_categories_replace_restricted_icon || 'lock';
    html += `${iconHTML(lockIcon)}` +
      `<span class="category-name" ${categoryDir}>${categoryName}</span>`;
  } else {
    html += `<span class="category-name" ${categoryDir}>${categoryName}</span>`;
  }
  html += "</span>";

  if (opts.topicCount && categoryStyle !== "box") {
    html += buildTopicCount(opts.topicCount);
  }

  if (href) {
    href = ` href="${href}" `;
  }

  extraClasses = categoryStyle ? categoryStyle + extraClasses : extraClasses;

  let afterBadgeWrapper = "";
  if (opts.topicCount && categoryStyle === "box") {
    afterBadgeWrapper += buildTopicCount(opts.topicCount);
  }
  return `<${tagName} class="badge-wrapper ${extraClasses}" ${href}>${html}</${tagName}>${afterBadgeWrapper}`;
}

function initializeHideCategories(api, ignore) {
  api.replaceCategoryLinkRenderer(newCategoryLinkRenderer);

  CategoryList.reopenClass({
    categoriesFrom() {
      let categories = this._super(...arguments)
      if (!ignore) return categories;
      else return categories.filter(c => !ignore.includes(c.slug));
    }
  });

  let user = api.getCurrentUser();
  if (user) {
    user.findDetails();

    let updateHiddenCategories = function(u) {
      let hidden = u.get("custom_fields.hidden_category_ids");
      if (!hidden || !hidden.length || hidden == "-1") hidden = [];
      else if (typeof(hidden) === "string") hidden = [hidden];
      u.set("hidden_category_ids", hidden);

      let shown = u.get("custom_fields.shown_category_ids");
      if (!shown || !shown.length || shown == "-1") shown = [];
      else if (typeof(shown) === "string") shown = [shown];
      u.set("shown_category_ids", shown);

      const categories = Category.list();
      categories.forEach(c => c.set("isShown", c.show_by_default));

      u.set("hiddenCategories", Category.findByIds(u.hidden_category_ids));
      u.set("shownCategories", Category.findByIds(u.shown_category_ids));
      u.hiddenCategories.forEach(c => c.set("isShown", false));
      u.shownCategories.forEach(c => c.set("isShown", true));
    };

    user.addObserver("custom_fields", updateHiddenCategories);
  }

  api.modifyClass("controller:preferences/categories", {
    actions: {
      save() {
        let actual_hidden = this.model.hiddenCategories.map(category => category.id);
        let actual_shown = this.model.shownCategories.map(category => category.id);

        // hack to ensure empty categories list gets saved
        let tmp1 = actual_hidden;
        if (!tmp1 || !tmp1.length) {
          tmp1 = [-1];
        }
        let tmp2 = actual_shown;
        if (!tmp2 || !tmp2.length) {
          tmp2 = [-1];
        }

        this.model.set("custom_fields.hidden_category_ids", tmp1);
        this.model.set("custom_fields.shown_category_ids", tmp2);
        const data = this.currentUser.getProperties(["custom_fields"]);

        ajax(userPath(`${this.currentUser.username_lower}.json`), {
          data: data,
          type: "PUT"
        }).then(() => this._super(...arguments))
          .catch(popupAjaxError);
      }
    }
  });

  api.modifyClass("route:discovery-categories", {
    setupController(controller, model) {
      controller.set("model", model);

      this.controllerFor("navigation/categories").setProperties({
        //showCategoryDropdown: user,
        showCategoryDropdown: model.get("can_create_category"),
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

  // api.modifyClass("component:d-navigation", {
  //   actions: {
  //     selectCategoryAdminDropdownAction(actionId) {
  //       switch (actionId) {
  //         case "hide":
  //           this.hideCategories();
  //           break;
  //         case "create":
  //           this.createCategory();
  //           break;
  //         case "reorder":
  //           this.reorderCategories();
  //           break;
  //       }
  //     }
  //   }
  // });

  // CategoriesAdminDropdown.reopen( {
  //   content: computed(function() {
  //     const items = [
  //       {
  //         id: "hide",
  //         name: I18n.t("categories.hide.title"),
  //         description: I18n.t("categories.hide.title_long"),
  //         icon: "far-eye-slash",
  //       }
  //     ];

  //     if (this.showCategoryAdmin) items.push(...this._super());

  //     return items;
  //   })
  // });
}

export default {
  name: "discourse-hide-categories",

  initialize(container) {
    const siteSettings = container.lookup("site-settings:main");
    if (siteSettings.discourse_hide_categories_enabled) {
      let ignore = siteSettings.permanently_hidden_categories.split("|");
      withPluginApi("0.8.16", function(api) {
        initializeHideCategories(api, ignore)
      });
    }
  }
};
