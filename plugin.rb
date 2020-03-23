# name: discourse-hide-categories
# about: A plugin that adds a menu to show/hide categories on the front page.
# version: 0.1
# authors: Joshua F. Robinson

register_asset 'stylesheets/discourse-hide-categories.scss'
register_asset 'javascripts/discourse/templates/navigation/categories.hbs'
register_asset 'javascripts/discourse/templates/components/categories-only.hbs'
register_asset 'javascripts/discourse/templates/components/d-navigation.hbs'

enabled_site_setting :discourse_hide_categories_enabled

after_initialize do
  register_editable_user_custom_field hidden_category_ids: []
end
DiscoursePluginRegistry.serialized_current_user_fields << 'hidden_category_ids'
