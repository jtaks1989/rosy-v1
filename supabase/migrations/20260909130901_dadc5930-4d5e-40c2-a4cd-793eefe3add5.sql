revoke execute on function public.rosy_menu_engineering_period(date, date, uuid[], text[], text[], text[], text[], text, numeric, integer, numeric, text, numeric, boolean, text) from public;
revoke execute on function public.rosy_menu_item_channels(uuid, date, date) from public;
revoke execute on function public.rosy_menu_item_trend(uuid, date, date, uuid[]) from public;
revoke execute on function public.rosy_menu_item_venues(text, date, date, uuid[]) from public;
grant execute on function public.rosy_menu_engineering_period(date, date, uuid[], text[], text[], text[], text[], text, numeric, integer, numeric, text, numeric, boolean, text) to authenticated, service_role;
grant execute on function public.rosy_menu_item_channels(uuid, date, date) to authenticated, service_role;
grant execute on function public.rosy_menu_item_trend(uuid, date, date, uuid[]) to authenticated, service_role;
grant execute on function public.rosy_menu_item_venues(text, date, date, uuid[]) to authenticated, service_role;