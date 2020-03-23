import Category from "discourse/models/category";

export default {
  shouldRender(args, component) {
    return Discourse.SiteSettings.discourse_hide_categories_enabled
  }
}
