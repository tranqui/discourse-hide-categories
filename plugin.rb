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
  register_category_custom_field_type 'force_show_groups', [:integer]
  Site.preloaded_category_custom_fields << 'show_by_default' if Site.respond_to? :preloaded_category_custom_fields
  Site.preloaded_category_custom_fields << 'suppress_restricted_icon' if Site.respond_to? :preloaded_category_custom_fields
  Site.preloaded_category_custom_fields << 'force_show' if Site.respond_to? :preloaded_category_custom_fields
  Site.preloaded_category_custom_fields << 'force_show_groups' if Site.respond_to? :preloaded_category_custom_fields
  Site.preloaded_category_custom_fields << 'user_force_show' if Site.respond_to? :preloaded_category_custom_fields

  DiscoursePluginRegistry.serialized_current_user_fields << 'hidden_category_ids'
  DiscoursePluginRegistry.serialized_current_user_fields << 'shown_category_ids'

  add_to_serializer(:basic_category, :show_by_default) {
    object.custom_fields['show_by_default']
  }

  add_to_serializer(:basic_category, :suppress_restricted_icon) {
    object.custom_fields['suppress_restricted_icon']
  }

  add_to_serializer(:category, :force_show) {
    object.custom_fields['force_show']
  }

  add_to_serializer(:category, :force_show_groups) {
    object.custom_fields['force_show_groups']
  }

  add_to_serializer(:basic_category, :user_force_show) {
    if object.custom_fields['force_show'] then
      user = scope && scope.user
      if user then
        everyone = Group::AUTO_GROUPS[:everyone]
        has_everyone = object.custom_fields["force_show_groups"] && object.custom_fields["force_show_groups"].include?(everyone)
        return true if has_everyone
        in_allowed_group = GroupUser.where(group_id: object.custom_fields["force_show_groups"], user_id: user.id).exists?
        return true if in_allowed_group
      end
    end
    false
  }

  reloadable_patch do
    category_overrides = Module.new do
      def category_params
        return super if !SiteSetting.discourse_hide_categories_enabled
        super.tap do |value|
          if params["custom_fields"] && groups = params["custom_fields"]["force_show_groups"]
            value["custom_fields"]["force_show_groups"] = groups
          end
        end
      end
    end

    CategoriesController.class_exec do
      prepend category_overrides
    end
  end
end
