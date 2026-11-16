alter table students add column invite_code text unique default encode(gen_random_bytes(5),'hex');
