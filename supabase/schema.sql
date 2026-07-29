-- Nome:     schema.sql
-- Versione: 1.0
-- Uso:      Schema completo del database Supabase per Fanta Montelago:
--           tabelle, funzioni di supporto, policy di Row Level Security e
--           bucket di storage per le foto-prova. Da eseguire una sola volta
--           nell'SQL Editor di Supabase su un progetto nuovo.
-- Autore:   Daniele Polucci

-- ===================================================================
-- 1. TABELLE
-- ===================================================================

-- Un accampamento e' il "clan" che gioca: ha un arbitro, dei membri e una
-- propria classifica completamente isolata dagli altri accampamenti.
create table if not exists public.accampamenti (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) between 2 and 60),
  edizione        text not null default 'Montelago Celtic Festival',
  modalita        text not null default 'classica',
  premio          text not null default '',
  codice_invito   text not null unique,
  creato_da       uuid not null references auth.users(id) on delete cascade,
  creato_il       timestamptz not null default now()
);

-- Chi ha accesso a un accampamento e con quale ruolo.
create table if not exists public.membri (
  id                 uuid primary key default gen_random_uuid(),
  accampamento_id    uuid not null references public.accampamenti(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  ruolo              text not null default 'giocatore' check (ruolo in ('arbitro','giocatore')),
  nome_visualizzato  text not null default '',
  entrato_il         timestamptz not null default now(),
  unique (accampamento_id, user_id)
);

-- Le persone del clan che compaiono in classifica. Non coincidono
-- necessariamente con i membri: si puo' schierare anche chi non usa l'app.
create table if not exists public.personaggi (
  id               uuid primary key default gen_random_uuid(),
  accampamento_id  uuid not null references public.accampamenti(id) on delete cascade,
  nome             text not null check (length(trim(nome)) between 1 and 60),
  soprannome       text not null default '',
  membro_id        uuid references public.membri(id) on delete set null,
  creato_il        timestamptz not null default now()
);

-- Il catalogo dei bonus e dei malus, personalizzabile per accampamento.
create table if not exists public.regole (
  id               uuid primary key default gen_random_uuid(),
  accampamento_id  uuid not null references public.accampamenti(id) on delete cascade,
  nome             text not null check (length(trim(nome)) between 2 and 120),
  punti            integer not null check (punti between -100 and 100),
  attiva           boolean not null default true,
  protetta         boolean not null default false,
  creato_il        timestamptz not null default now()
);

-- Gli eventi assegnati. Nascono come 'proposto' quando li segnala un
-- giocatore e diventano 'approvato' solo per mano dell'arbitro; i punti e il
-- nome della regola sono copiati qui dentro perche' modificare una regola in
-- seguito non deve riscrivere la storia della classifica.
create table if not exists public.eventi (
  id               uuid primary key default gen_random_uuid(),
  accampamento_id  uuid not null references public.accampamenti(id) on delete cascade,
  personaggio_id   uuid not null references public.personaggi(id) on delete cascade,
  regola_id        uuid references public.regole(id) on delete set null,
  regola_nome      text not null,
  punti            integer not null,
  nota             text not null default '',
  giornata         date not null default (now() at time zone 'Europe/Rome')::date,
  foto_path        text,
  video_url        text,
  stato            text not null default 'proposto' check (stato in ('proposto','approvato','rifiutato')),
  proposto_da      uuid not null references auth.users(id) on delete cascade,
  deciso_da        uuid references auth.users(id) on delete set null,
  creato_il        timestamptz not null default now()
);

-- Colonne aggiunte dopo la prima versione. Servono a chi ha gia' eseguito
-- questo schema in passato: "create table if not exists" lascia intatte le
-- tabelle che esistono, quindi le novita' vanno applicate a parte.
alter table public.accampamenti add column if not exists premio text not null default '';
alter table public.accampamenti add column if not exists bandiera_path text;
alter table public.regole add column if not exists protetta boolean not null default false;
alter table public.personaggi add column if not exists titolo text not null default '';

create index if not exists eventi_accampamento_idx on public.eventi (accampamento_id, stato);
create index if not exists eventi_personaggio_idx  on public.eventi (personaggio_id);
create index if not exists membri_user_idx         on public.membri (user_id);
create index if not exists personaggi_camp_idx     on public.personaggi (accampamento_id);
create index if not exists regole_camp_idx         on public.regole (accampamento_id);

-- ===================================================================
-- 2. FUNZIONI DI SUPPORTO
-- ===================================================================
-- Sono SECURITY DEFINER perche' devono poter leggere "membri" ignorando la
-- RLS: se una policy su membri interrogasse membri stessa, Postgres andrebbe
-- in ricorsione infinita.

create or replace function public.is_membro(camp uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.membri m
    where m.accampamento_id = camp and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_arbitro(camp uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.membri m
    where m.accampamento_id = camp and m.user_id = auth.uid() and m.ruolo = 'arbitro'
  );
$$;

-- Cast tollerante: i path dello storage sono testo libero e un nome di
-- cartella non valido deve dare "nessun accesso", non un errore SQL.
create or replace function public.safe_uuid(t text)
returns uuid language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

-- Codice invito leggibile: niente 0/O/1/I per evitare errori di trascrizione
-- quando lo si detta ad alta voce in mezzo al campo.
-- SECURITY DEFINER: per garantire che il codice sia unico deve poter vedere
-- TUTTI gli accampamenti, non solo quelli di chi lo sta creando.
create or replace function public.genera_codice()
returns text language plpgsql security definer set search_path = public as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tentativo text;
  i integer;
begin
  loop
    tentativo := '';
    for i in 1..6 loop
      tentativo := tentativo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.accampamenti a where a.codice_invito = tentativo);
  end loop;
  return tentativo;
end $$;

-- ===================================================================
-- 3. TRIGGER
-- ===================================================================

-- Chi crea l'accampamento ne diventa automaticamente l'arbitro, e riceve un
-- codice invito se non lo ha fornito.
create or replace function public.dopo_creazione_accampamento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.membri (accampamento_id, user_id, ruolo, nome_visualizzato)
  values (new.id, new.creato_da, 'arbitro',
          coalesce(nullif(trim((auth.jwt() -> 'user_metadata' ->> 'nome')), ''), 'Arbitro'));
  return new;
end $$;

drop trigger if exists trg_dopo_creazione_accampamento on public.accampamenti;
create trigger trg_dopo_creazione_accampamento
  after insert on public.accampamenti
  for each row execute function public.dopo_creazione_accampamento();

create or replace function public.prima_inserimento_accampamento()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.codice_invito is null or trim(new.codice_invito) = '' then
    new.codice_invito := public.genera_codice();
  end if;
  new.creato_da := auth.uid();
  return new;
end $$;

drop trigger if exists trg_prima_inserimento_accampamento on public.accampamenti;
create trigger trg_prima_inserimento_accampamento
  before insert on public.accampamenti
  for each row execute function public.prima_inserimento_accampamento();

-- Un giocatore normale puo' solo *proporre*: qualunque stato lui provi a
-- scrivere viene riportato a 'proposto'. L'arbitro invece decide liberamente.
create or replace function public.forza_stato_evento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.proposto_da := coalesce(new.proposto_da, auth.uid());

  -- Punteggio e descrizione non si accettano dal browser: si rileggono dalla
  -- regola citata, altrimenti chiunque potrebbe proporre un bonus da 999.
  if tg_op = 'INSERT' and new.regola_id is not null then
    select r.nome, r.punti into new.regola_nome, new.punti
    from public.regole r
    where r.id = new.regola_id and r.accampamento_id = new.accampamento_id;

    if new.regola_nome is null then
      raise exception 'Regola inesistente o di un altro accampamento';
    end if;
  end if;

  -- Su UPDATE solo l'arbitro puo' ritoccare il punteggio a mano.
  if tg_op = 'UPDATE' and not public.is_arbitro(new.accampamento_id) then
    new.punti := old.punti;
    new.regola_nome := old.regola_nome;
  end if;

  if not public.is_arbitro(new.accampamento_id) then
    new.stato := 'proposto';
    new.deciso_da := null;
  elsif tg_op = 'INSERT' then
    -- L'arbitro che segna di persona non deve approvare se stesso.
    new.stato := coalesce(nullif(new.stato, 'proposto'), 'approvato');
    new.deciso_da := auth.uid();
  elsif new.stato is distinct from old.stato then
    new.deciso_da := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_forza_stato_evento on public.eventi;
create trigger trg_forza_stato_evento
  before insert or update on public.eventi
  for each row execute function public.forza_stato_evento();

-- ===================================================================
-- 4. ROW LEVEL SECURITY
-- ===================================================================
-- Regola d'oro: nessuna riga e' visibile se non sei membro di quell'accampamento.

alter table public.accampamenti enable row level security;
alter table public.membri       enable row level security;
alter table public.personaggi   enable row level security;
alter table public.regole       enable row level security;
alter table public.eventi       enable row level security;

-- --- accampamenti ---
drop policy if exists acc_select on public.accampamenti;
create policy acc_select on public.accampamenti
  for select to authenticated using (public.is_membro(id));

drop policy if exists acc_insert on public.accampamenti;
create policy acc_insert on public.accampamenti
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists acc_update on public.accampamenti;
create policy acc_update on public.accampamenti
  for update to authenticated using (public.is_arbitro(id)) with check (public.is_arbitro(id));

drop policy if exists acc_delete on public.accampamenti;
create policy acc_delete on public.accampamenti
  for delete to authenticated using (public.is_arbitro(id));

-- --- membri ---
drop policy if exists mem_select on public.membri;
create policy mem_select on public.membri
  for select to authenticated using (public.is_membro(accampamento_id));

-- L'ingresso passa solo dalla funzione entra_con_codice(), mai da un insert
-- diretto: e' il codice invito a fare da chiave, non la conoscenza dell'id.
drop policy if exists mem_update on public.membri;
create policy mem_update on public.membri
  for update to authenticated
  using (user_id = auth.uid() or public.is_arbitro(accampamento_id));

drop policy if exists mem_delete on public.membri;
create policy mem_delete on public.membri
  for delete to authenticated
  using (user_id = auth.uid() or public.is_arbitro(accampamento_id));

-- --- personaggi e regole: leggono tutti i membri, scrive solo l'arbitro ---
drop policy if exists per_select on public.personaggi;
create policy per_select on public.personaggi
  for select to authenticated using (public.is_membro(accampamento_id));

drop policy if exists per_write on public.personaggi;
create policy per_write on public.personaggi
  for all to authenticated
  using (public.is_arbitro(accampamento_id)) with check (public.is_arbitro(accampamento_id));

drop policy if exists reg_select on public.regole;
create policy reg_select on public.regole
  for select to authenticated using (public.is_membro(accampamento_id));

-- Le regole si scrivono solo da arbitro, e quelle protette non si toccano
-- affatto. Il divieto sta qui e non solo nell'interfaccia, cosi' non lo si
-- aggira dalla console del browser.
--
-- La RLS non vale per le cancellazioni a cascata ne' per le funzioni
-- SECURITY DEFINER: eliminare un accampamento e ripristinare il regolamento
-- continuano quindi a funzionare senza eccezioni particolari.
drop policy if exists reg_write on public.regole;

drop policy if exists reg_insert on public.regole;
create policy reg_insert on public.regole
  for insert to authenticated
  with check (public.is_arbitro(accampamento_id) and not protetta);

drop policy if exists reg_update on public.regole;
create policy reg_update on public.regole
  for update to authenticated
  using (public.is_arbitro(accampamento_id) and not protetta)
  with check (public.is_arbitro(accampamento_id) and not protetta);

drop policy if exists reg_delete on public.regole;
create policy reg_delete on public.regole
  for delete to authenticated
  using (public.is_arbitro(accampamento_id) and not protetta);

-- --- eventi ---
drop policy if exists evt_select on public.eventi;
create policy evt_select on public.eventi
  for select to authenticated using (public.is_membro(accampamento_id));

drop policy if exists evt_insert on public.eventi;
create policy evt_insert on public.eventi
  for insert to authenticated with check (public.is_membro(accampamento_id));

-- L'arbitro corregge tutto; il giocatore puo' ritoccare o ritirare solo una
-- propria proposta ancora in attesa di giudizio.
drop policy if exists evt_update on public.eventi;
create policy evt_update on public.eventi
  for update to authenticated
  using (public.is_arbitro(accampamento_id)
         or (proposto_da = auth.uid() and stato = 'proposto'));

drop policy if exists evt_delete on public.eventi;
create policy evt_delete on public.eventi
  for delete to authenticated
  using (public.is_arbitro(accampamento_id)
         or (proposto_da = auth.uid() and stato = 'proposto'));

-- ===================================================================
-- 5. INGRESSO IN UN ACCAMPAMENTO
-- ===================================================================
-- SECURITY DEFINER: e' l'unico modo per inserirsi in "membri", e accetta solo
-- chi presenta un codice invito valido.

create or replace function public.entra_con_codice(codice text, nome text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  camp uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi effettuare l''accesso';
  end if;

  select a.id into camp
  from public.accampamenti a
  where upper(a.codice_invito) = upper(trim(codice));

  if camp is null then
    raise exception 'Codice invito non valido';
  end if;

  insert into public.membri (accampamento_id, user_id, ruolo, nome_visualizzato)
  values (camp, auth.uid(), 'giocatore', nullif(trim(nome), ''))
  on conflict (accampamento_id, user_id)
    do update set nome_visualizzato = coalesce(nullif(trim(nome), ''), public.membri.nome_visualizzato);

  return camp;
end $$;

revoke all on function public.entra_con_codice(text, text) from public;
grant execute on function public.entra_con_codice(text, text) to authenticated;

-- Il regolamento ufficiale del Fanta Montelago, scritto dalla Compagnia di
-- Sotto Monte. Sta in una funzione a se' perche' serve in due momenti: quando
-- nasce un accampamento e quando l'arbitro vuole ripartire da capo.
create or replace function public.regole_base()
returns table (nome text, punti integer)
language sql immutable as $$
  select * from (values
    ('Ubriaco di giorno'::text,                             -15),
    ('Ubriaco già all''aperitivo',                          -10),
    ('Ubriaco',                                              -5),
    ('Dignitosamente brillo',                                 5),
    ('Ubriaco molesto',                                     -10),
    ('Vomitazzo',                                           -15),
    ('Croce Rossa per Alcolismo',                           -20),
    ('Croce Rossa per infortunio',                          -10),
    ('Ottenuto Instagram di un* ragazz*',                     5),
    ('Ottenuto telefono di un* ragazz*',                      7),
    ('Pomiciato un* ragazz*',                                 8),
    ('Sesso in tenda con persona nuova',                     20),
    ('3some',                                                50),
    ('4some',                                                70),
    ('Partecipato ad un''orgia',                            100),
    ('Trucco o tatoo celtici',                                5),
    ('Abbandona la serata prima delle 21',                  -10),
    ('Dal Primo Giorno',                                      5),
    ('Porta approvigionamenti',                               5),
    ('Offre da bere (ad personam)',                           5),
    ('Matrimonio Celtico',                                   10),
    ('Kilt',                                                  5),
    ('Vestito Celta',                                         5),
    ('Turno Tenda Giochi',                                    5),
    ('Foto con persona conosciuta',                           5),
    ('Foto con persona sconosciuta',                         10),
    ('Foto con Giorgione',                                   10),
    ('Foto con Vip',                                         15),
    ('Foto con Simone (della sicurezza)',                     5),
    ('Bonus: Siria',                                         10),
    ('Vello d''oro (dalla Croce Rossa)',                      5),
    ('Perde il telefono',                                   -10),
    ('Cucina',                                                5),
    ('Recupero Ghiaccio',                                     5),
    ('Ripara',                                                5),
    ('Ricercato su Spottedmontelago',                        10),
    ('Pubblicità alla Compagnia di Sotto Monte sui social',   5),
    ('Fai pubblicità al Fanta Montelago sui social',          5),
    ('Caduto nella Cloaca',                                 -15),
    ('Scottato',                                             -5),
    ('Portato una nuova Persona all''accampamento',           5),
    ('Portato 3 nuove persone all''accampamento',            10),
    ('Portato 5+ nuove persone all''accampamento',           15),
    ('Non Rimbalza un Valerio',                              -5),
    ('Diventa il nuovo Valerio',                             40),
    ('Sbaglia tenda',                                       -10),
    ('Si perde',                                            -10),
    ('Il vento ti denuda',                                  -10),
    ('Ben10',                                              -100),
    ('Stella sulla chiappa',                                 30)
  ) as t(nome, punti);
$$;

-- ===================================================================
-- RICONOSCERSI NELLA CLASSIFICA
-- ===================================================================
-- I personaggi li inserisce l'arbitro e non sono legati a un account: senza
-- questo passaggio l'app non ha modo di sapere quale riga della classifica
-- corrisponda a chi la sta guardando, e il riepilogo personale sarebbe
-- impossibile. Chi non usa l'app resta semplicemente non abbinato.

-- Con "pers" nullo l'abbinamento viene semplicemente sciolto: serve l'id
-- dell'accampamento proprio perche' senza personaggio non ci sarebbe altro
-- modo di sapere in quale gruppo stiamo operando.
create or replace function public.rivendica_personaggio(camp uuid, pers uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  mio_membro uuid;
begin
  select m.id into mio_membro from public.membri m
  where m.accampamento_id = camp and m.user_id = auth.uid();
  if mio_membro is null then
    raise exception 'Non fai parte di questo accampamento';
  end if;

  -- Una persona sola per personaggio e un personaggio solo per persona:
  -- scegliendone un altro, il precedente si libera da se'.
  update public.personaggi set membro_id = null
  where accampamento_id = camp and membro_id = mio_membro;

  if pers is null then
    return;
  end if;

  if not exists (
    select 1 from public.personaggi p
    where p.id = pers and p.accampamento_id = camp
  ) then
    raise exception 'Personaggio inesistente in questo accampamento';
  end if;

  if exists (
    select 1 from public.personaggi p
    where p.id = pers and p.membro_id is not null and p.membro_id <> mio_membro
  ) then
    raise exception 'Questo personaggio se l''è già preso qualcun altro';
  end if;

  update public.personaggi set membro_id = mio_membro where id = pers;
end $$;

revoke all on function public.rivendica_personaggio(uuid, uuid) from public;
grant execute on function public.rivendica_personaggio(uuid, uuid) to authenticated;

-- Il titolo lo calcola l'app dai punti fatti, ma qui si puo' scrivere a mano.
-- Puo' farlo l'arbitro su chiunque, e ciascuno sul proprio: un soprannome
-- affibbiato da un algoritmo dev'essere correggibile da chi se lo porta.
-- Titolo vuoto significa "torna a quello automatico".
create or replace function public.imposta_titolo(pers uuid, nuovo text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  camp uuid;
  proprietario uuid;
  mio_membro uuid;
begin
  select p.accampamento_id, p.membro_id into camp, proprietario
  from public.personaggi p where p.id = pers;
  if camp is null then
    raise exception 'Personaggio inesistente';
  end if;

  select m.id into mio_membro from public.membri m
  where m.accampamento_id = camp and m.user_id = auth.uid();
  if mio_membro is null then
    raise exception 'Non fai parte di questo accampamento';
  end if;

  if not public.is_arbitro(camp)
     and (proprietario is null or proprietario <> mio_membro) then
    raise exception 'Puoi cambiare solo il tuo titolo';
  end if;

  update public.personaggi
  set titolo = left(trim(coalesce(nuovo, '')), 40)
  where id = pers;
end $$;

revoke all on function public.imposta_titolo(uuid, text) from public;
grant execute on function public.imposta_titolo(uuid, text) to authenticated;

-- Le due regole promozionali restano in ogni accampamento: nessun arbitro puo'
-- cancellarle, disattivarle o cambiarne il punteggio. Sono elencate qui in un
-- posto solo, cosi' le policy, la semina e il ripristino guardano tutte la
-- stessa lista.
create or replace function public.regola_protetta(n text)
returns boolean language sql immutable as $$
  select n in (
    'Pubblicità alla Compagnia di Sotto Monte sui social',
    'Fai pubblicità al Fanta Montelago sui social'
  );
$$;

-- Catalogo iniziale, applicato alla nascita dell'accampamento.
-- Idempotente: se le regole ci sono gia' non tocca niente.
create or replace function public.semina_regole(camp uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_membro(camp) then
    raise exception 'Accampamento non accessibile';
  end if;

  if exists (select 1 from public.regole r where r.accampamento_id = camp) then
    return;
  end if;

  insert into public.regole (accampamento_id, nome, punti, protetta)
  select camp, b.nome, b.punti, public.regola_protetta(b.nome)
  from public.regole_base() b;
end $$;

grant execute on function public.semina_regole(uuid) to authenticated;

-- Ripristino del regolamento ufficiale: cancella le regole attuali,
-- comprese quelle personalizzate, e rimette quelle di base.
-- Gli eventi gia' registrati non si toccano, perche' conservano una copia del
-- nome e del punteggio con cui erano stati assegnati.
create or replace function public.ricarica_regole_base(camp uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  quante integer;
begin
  if not public.is_arbitro(camp) then
    raise exception 'Solo l''arbitro puo'' ripristinare il regolamento';
  end if;

  delete from public.regole where accampamento_id = camp;

  insert into public.regole (accampamento_id, nome, punti, protetta)
  select camp, b.nome, b.punti, public.regola_protetta(b.nome)
  from public.regole_base() b;

  get diagnostics quante = row_count;
  return quante;
end $$;

revoke all on function public.ricarica_regole_base(uuid) from public;
grant execute on function public.ricarica_regole_base(uuid) to authenticated;

-- Adeguamento degli accampamenti gia' esistenti: aggiunge la regola
-- promozionale nuova dove manca e marca come protette quelle di bandiera,
-- riattivandole se qualcuno le aveva spente.
insert into public.regole (accampamento_id, nome, punti, protetta)
select a.id, 'Fai pubblicità al Fanta Montelago sui social', 5, true
from public.accampamenti a
where not exists (
  select 1 from public.regole r
  where r.accampamento_id = a.id
    and r.nome = 'Fai pubblicità al Fanta Montelago sui social'
);

update public.regole
set protetta = true, attiva = true
where public.regola_protetta(nome)
  and not (protetta and attiva);

-- Creazione dell'accampamento in un blocco unico.
--
-- Non si puo' creare l'accampamento con una INSERT diretta dal client: la
-- policy di lettura pretende che tu ne sia gia' membro, ma l'iscrizione
-- avviene solo dopo l'inserimento, quindi la riga appena creata risulterebbe
-- invisibile a chi l'ha creata e l'operazione fallirebbe. Qui invece
-- inserimento, iscrizione come arbitro e catalogo iniziale avvengono dentro
-- la stessa transazione, e in caso di problemi non resta niente a meta'.
create or replace function public.crea_accampamento(nome text, edizione text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  nuovo_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi effettuare l''accesso';
  end if;
  if length(trim(coalesce(nome, ''))) < 2 then
    raise exception 'Il nome dell''accampamento e'' troppo corto';
  end if;

  insert into public.accampamenti (nome, edizione, codice_invito, creato_da)
  values (trim(nome),
          coalesce(nullif(trim(edizione), ''), 'Montelago Celtic Festival'),
          public.genera_codice(),
          auth.uid())
  returning id into nuovo_id;

  -- L'iscrizione come arbitro la fa il trigger AFTER INSERT, che a questo
  -- punto della funzione ha gia' terminato: la statement precedente e' chiusa.
  perform public.semina_regole(nuovo_id);

  return nuovo_id;
end $$;

revoke all on function public.crea_accampamento(text, text) from public;
grant execute on function public.crea_accampamento(text, text) to authenticated;

-- ===================================================================
-- 6. STORAGE DELLE FOTO-PROVA
-- ===================================================================
-- Bucket privato: i file stanno in <accampamento_id>/<nome>.jpg e si leggono
-- solo tramite URL firmati a scadenza, generati per i membri.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prove', 'prove', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists prove_select on storage.objects;
create policy prove_select on storage.objects
  for select to authenticated
  using (bucket_id = 'prove'
         and public.is_membro(public.safe_uuid((storage.foldername(name))[1])));

drop policy if exists prove_insert on storage.objects;
create policy prove_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'prove'
              and public.is_membro(public.safe_uuid((storage.foldername(name))[1])));

drop policy if exists prove_delete on storage.objects;
create policy prove_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'prove'
         and public.is_arbitro(public.safe_uuid((storage.foldername(name))[1])));
