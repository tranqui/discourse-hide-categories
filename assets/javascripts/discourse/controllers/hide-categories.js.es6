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

registerHelper("not", function([value]) {
  return !value;
});

export default Controller.extend(ModalFunctionality, Evented, {
  init() {
    this._super(...arguments);

    this.categoriesSorting = ["position"];
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
    console.log("new destroy");
    this._super(...arguments);
    this.appEvents.off("modal-body:flash", this, "_flash");
    this.appEvents.off("modal-body:clearFlash", this, "_clearFlash");
    this.appEvents.trigger("modal:body-dismissed");
  },

  actions: {
    change(category, event) {
      category.content.set("isHidden", !event.target.checked);
    },

    save() {
      this.set("saved", false);

      let new_hidden_category_ids = this.categoriesOrdered.filter(c => c.content.isHidden).map(c => c.content.id);

      // hack to ensure empty categories list gets saved
      let tmp = new_hidden_category_ids;
      if (!tmp || !tmp.length) {
        tmp = [-1];
      }

      this.currentUser.set("custom_fields.hidden_category_ids", tmp);
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

      this.currentUser.set("custom_fields.hidden_category_ids", new_hidden_category_ids);
    }
  }
});
