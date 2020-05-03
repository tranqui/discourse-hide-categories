import { sort } from "@ember/object/computed";
import Evented from "@ember/object/evented";
import EmberObjectProxy from "@ember/object/proxy";
import Controller from "@ember/controller";
import { ajax } from "discourse/lib/ajax";
import ModalFunctionality from "discourse/mixins/modal-functionality";
const BufferedProxy = window.BufferedProxy;
import { popupAjaxError } from "discourse/lib/ajax-error";
import discourseComputed, { on } from "discourse-common/utils/decorators";

import { getProperties } from "@ember/object";
import { userPath } from "discourse/lib/url";

import { registerHelper } from "discourse-common/lib/helpers";

registerHelper("isTrue", function([value]) {
  return value == true;
});

registerHelper("hideCheckbox", function([category]) {
  return category.get("force_show") || category.get("parent_category_id")
});

export default Controller.extend(ModalFunctionality, Evented, {
  init() {
    this._super(...arguments);

    this.categoriesSorting = ["position"];

    this.new_hidden_category_ids = this.currentUser.get("hidden_category_ids").map(c => Number(c));
    this.new_shown_category_ids = this.currentUser.get("shown_category_ids").map(c => Number(c));
  },

  @discourseComputed("site.categories")
  categoriesBuffered(categories) {
    const bufProxy = EmberObjectProxy.extend(BufferedProxy);
    let buffered = categories.map(c => bufProxy.create({ content: c }));
    let ignore = Discourse.SiteSettings.permanently_hidden_categories.split("|");
    return buffered.filter(c => !ignore.includes(c.content.slug));
  },

  categoriesOrdered: sort("categoriesBuffered", "categoriesSorting"),

  /**
   * 1. Make sure all categories have unique position numbers.
   * 2. Place sub-categories after their parent categories while maintaining
   *    the same relative order.
   *
   *    e.g.
   *      parent/c2/c1          parent
   *      parent/c1             parent/c1
   *      parent          =>    parent/c2
   *      other                 parent/c2/c1
   *      parent/c2             other
   *
   **/
  @on("init")
  order() {
    const hideChildren = (categoryId, depth, index) => {
      this.categoriesOrdered.forEach(category => {
        if (
          (categoryId === null && !category.get("parent_category_id")) ||
          category.get("parent_category_id") === categoryId
        ) {
          category.setProperties({ depth, position: index++ });
          index = hideChildren(category.get("id"), depth + 1, index);
        }
      });

      return index;
    };

    hideChildren(null, 0, 0);

    this.categoriesBuffered.forEach(bc => {
      if (bc.get("hasBufferedChanges")) {
        bc.applyBufferedChanges();
      }
    });

    this.notifyPropertyChange("categoriesBuffered");
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off("modal-body:flash", this, "_flash");
    this.appEvents.off("modal-body:clearFlash", this, "_clearFlash");
    this.appEvents.trigger("modal:body-dismissed");
  },

  actions: {
    change(category, event) {
      category.content.set("isShown", event.target.checked);

      let id = category.get("id");
      if (event.target.checked) {
        const hidden_index = this.new_hidden_category_ids.indexOf(id);
        if (hidden_index > -1) {
          this.new_hidden_category_ids.splice(hidden_index, 1);
        }

        const shown_index = this.new_shown_category_ids.indexOf(id);
        if (shown_index === -1) {
          this.new_shown_category_ids.push(id);
        }
      }
      else {
        const shown_index = this.new_shown_category_ids.indexOf(id);
        if (shown_index > -1) {
          this.new_shown_category_ids.splice(shown_index, 1);
        }

        const hidden_index = this.new_hidden_category_ids.indexOf(id);
        if (hidden_index === -1) {
          this.new_hidden_category_ids.push(id);
        }
      }
    },

    save() {
      this.set("saved", false);

      // hack to ensure empty categories list gets saved
      let tmp1 = this.new_hidden_category_ids;
      if (!tmp1 || !tmp1.length) {
        tmp1 = [-1];
      }
      tmp1 = tmp1.map(c => c.toString());
      let tmp2 = this.new_shown_category_ids;
      if (!tmp2 || !tmp2.length) {
        tmp2 = [-1];
      }
      tmp2 = tmp2.map(c => c.toString());

      this.currentUser.set("custom_fields.hidden_category_ids", tmp1);
      this.currentUser.set("custom_fields.shown_category_ids", tmp2);
      const data = this.currentUser.getProperties(["custom_fields"]);

      ajax(userPath(`${this.currentUser.username_lower}.json`), {
        data: data,
        type: "PUT"
      }).then(
        () => {
          this.set("saved", true);
          this.send("closeModal");
        })
        .catch(popupAjaxError);
    }
  }
});
