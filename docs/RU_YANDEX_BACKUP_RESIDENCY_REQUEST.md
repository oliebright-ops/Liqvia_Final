# U3 — request to Yandex Cloud Support on backup and WAL residency

**Why this exists.** U3 is the last blocker on publishing `/privacy` and `/consent`. It cannot be
closed by an API call: neither the cluster object nor the backup list exposes a storage-region
field (verified 2026-08-10, see `RU_DATABASE_CONFIGURATION.md` §4.2). It therefore needs a written
answer from the provider, kept on file as evidence.

**Do not close U3 on a forum post, a blog article, or a support agent's verbal assurance.** What is
needed is a written statement, in the support ticket itself, that names the region. Attach the
reply to this repository (redacting any ticket-internal identifiers you would rather not commit).

Send from the account that owns cloud `b1gvcg9tpc5iu530caqv`, via the Yandex Cloud console support
form, so the ticket is bound to the right organisation.

---

## Russian text — send this

> **Тема:** Место физического хранения резервных копий и WAL для кластера Managed PostgreSQL
>
> Здравствуйте.
>
> Мы обрабатываем персональные данные граждан Российской Федерации и обязаны документально
> подтвердить их локализацию в соответствии с Федеральным законом № 152-ФЗ.
>
> Кластер: `c9q985emaom0p6128t5r` (`liqvia-ru-leads`)
> Каталог: `b1gi2v3fopp7mu2p0d2a`
> Облако: `b1gvcg9tpc5iu530caqv`
> Регион кластера: `ru-central1`, хост-мастер в зоне `ru-central1-a`
>
> Просим предоставить письменный ответ по следующим вопросам:
>
> 1. В каком регионе физически хранятся **автоматические резервные копии** этого кластера?
>    Находятся ли они полностью на территории Российской Федерации?
> 2. В каком регионе физически хранятся **журналы WAL**, используемые для восстановления на
>    момент времени (PITR) для этого кластера? Находятся ли они полностью на территории
>    Российской Федерации?
> 3. Покидают ли резервные копии или журналы WAL территорию Российской Федерации при любых
>    штатных операциях — в том числе при репликации хранилища, аварийном переключении,
>    обслуживании или создании дополнительных копий?
> 4. Может ли клиент выбрать или ограничить регион хранения резервных копий, и если да — каким
>    образом?
> 5. Доступен ли параметр региона хранения резервных копий через API или CLI? Если нет —
>    подтвердите, пожалуйста, что этот параметр не публикуется, чтобы мы могли сослаться на
>    настоящий ответ как на источник сведений.
> 6. Каким образом шифруются резервные копии и где хранятся ключи шифрования? В документации
>    указано шифрование GPG с отдельными ключами для каждого кластера — просим подтвердить это
>    применительно к указанному кластеру.
>
> Ответ необходим в письменном виде для приобщения к документации по обработке персональных
> данных.
>
> Благодарим за помощь.

---

## English text — if the ticket is handled in English

> **Subject:** Physical storage location of backups and WAL for a Managed PostgreSQL cluster
>
> We process personal data of Russian Federation citizens and must document its localisation under
> Federal Law No. 152-FZ.
>
> Cluster: `c9q985emaom0p6128t5r` (`liqvia-ru-leads`) · Folder: `b1gi2v3fopp7mu2p0d2a` ·
> Cloud: `b1gvcg9tpc5iu530caqv` · Region: `ru-central1`, master host in `ru-central1-a`
>
> Please confirm in writing:
>
> 1. In which region are this cluster's **automated backups** physically stored? Are they held
>    entirely within the Russian Federation?
> 2. In which region are the **WAL segments** used for point-in-time recovery physically stored?
>    Are they held entirely within the Russian Federation?
> 3. Do backups or WAL ever leave the Russian Federation during any normal operation — storage
>    replication, failover, maintenance, or additional copies?
> 4. Can a customer select or constrain the backup storage region, and if so how?
> 5. Is the backup storage region exposed through the API or CLI? If not, please confirm that it
>    is not published, so that we may cite this reply as the source.
> 6. How are backups encrypted and where are the encryption keys held? Your documentation states
>    GPG encryption with separate keys per cluster — please confirm this for the cluster above.
>
> A written answer is required for our personal-data processing records.

---

## What each answer unlocks

| Answer | Effect |
|---|---|
| 1 + 2 both confirm RF-only | U3 closes. Strike it from `UNVERIFIED_PROCESSING_FACTS`, replace the `backup-residency` marker in `/privacy` and `/consent` with the confirmed statement, cite the ticket |
| 3 reveals any egress | **Do not publish a residency claim.** This becomes a cross-border transfer that must be disclosed and lawfully based — a materially different document |
| 4 offers a control | Apply it, then re-verify |
| 5 confirms no API field | Record it, so nobody re-opens this looking for a field that does not exist |
| 6 confirms encryption | Upgrades the GPG statement in §4 from vendor documentation to cluster-specific written confirmation |

If the reply is ambiguous, or answers a question you did not ask, treat U3 as still open and go
back. An ambiguous answer about residency is not evidence of residency.
