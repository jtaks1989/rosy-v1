
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.has_permission(text) from public, anon;
revoke all on function public.has_location_access(uuid) from public, anon;
revoke all on function public.my_investor_ids() from public, anon;
revoke all on function public.my_entitled_entity_ids() from public, anon;
grant execute on function public.is_member(uuid), public.has_permission(text), public.has_location_access(uuid), public.my_investor_ids(), public.my_entitled_entity_ids() to authenticated;
