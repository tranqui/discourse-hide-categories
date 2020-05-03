# name: discourse-hide-categories
# about: A plugin that adds a menu to show/hide categories on the front page.
# version: 1.0
# authors: Joshua F. Robinson

register_asset 'stylesheets/discourse-hide-categories.scss'
register_asset 'javascripts/discourse/templates/navigation/categories.hbs'
register_asset 'javascripts/discourse/templates/components/categories-only.hbs'
register_asset 'javascripts/discourse/templates/mobile/components/categories-only.hbs'
register_asset 'javascripts/discourse/templates/components/d-navigation.hbs'
register_asset 'javascripts/discourse/templates/components/category-title-link.hbs'

enabled_site_setting :discourse_hide_categories_enabled

after_initialize do
  register_editable_user_custom_field hidden_category_ids: []
  register_editable_user_custom_field shown_category_ids: []
  register_category_custom_field_type 'show_by_default', :boolean
  register_category_custom_field_type 'suppress_restricted_icon', :boolean
  register_category_custom_field_type 'force_show', :boolean

  DiscoursePluginRegistry.serialized_current_user_fields << 'hidden_category_ids'
  DiscoursePluginRegistry.serialized_current_user_fields << 'shown_category_ids'

  add_to_serializer(:basic_category, :show_by_default) {
    object.custom_fields['show_by_default']
  }

  add_to_serializer(:basic_category, :suppress_restricted_icon) {
    object.custom_fields['suppress_restricted_icon']
  }

  add_to_serializer(:basic_category, :force_show) {
    object.custom_fields['force_show']
  }
end
