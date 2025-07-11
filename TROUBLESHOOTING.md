# Документация по сложным и решенным проблемам

Этот документ содержит описание нетривиальных проблем, с которыми мы столкнулись в ходе разработки, и пути их решения.

## 1. Некорректное определение номера звонящего

-   **Проблема:** Система иногда отображала внутренний номер очереди или оператора вместо реального номера клиента, который совершал звонок.
-   **Причина:** Логика получения номера звонящего была недостаточно надежной. В некоторых сценариях (например, при звонках через очередь) она по ошибке считывала номер из канала оператора, а не из канала клиента.
-   **Решение:** Была внедрена иерархическая (многоуровневая) логика получения номера в файле `src/actions/asterisk.ts` (функция `getOperatorState`). Теперь система последовательно пытается определить номер, используя самые надежные методы:
    1.  **Приоритет 1: Поиск в "мосте" (Bridge):** Анализируется соединение между оператором и клиентом, и номер извлекается напрямую из канала клиента.
    2.  **Приоритет 2: Переменная `CONNECTEDLINE`:** Если "мост" еще не создан, система обращается к специальной переменной канала, где Asterisk хранит номер второго участника.
    3.  **Приоритет 3: "Родительский" канал:** В качестве резервного варианта анализируется, какой канал инициировал вызов на оператора.
    Старый, ошибочный метод был полностью удален, что гарантирует показ корректного номера или "Неизвестно", но не неверных данных.

## 2. Расхождение в ID звонков и ошибка загрузки деталей

-   **Проблема:** При попытке открыть детали звонка из списка "Задачи на перезвон" появлялась ошибка "не удалось загрузить детали звонка".
-   **Причина:** Было обнаружено, что ID, который система получала от Asterisk в реальном времени (например, `1751290283.275`), мог незначительно отличаться от ID, который записывался в базу данных истории звонков CDR (например, `1751290283.274`). Расхождение было в суффиксе после точки. Стандартный поиск по точному совпадению не мог найти запись.
-   **Решение:** Функция `getCallById` в файле `src/actions/cdr.ts` была модифицирована для "гибкого" поиска. Теперь она:
    1.  Выделяет основную часть ID (все, что до точки).
    2.  Использует SQL-оператор `LIKE` для поиска всех записей, `uniqueid` которых *начинается* с этой основной части.
    3.  Дополнительно продолжает проверять поле `linkedid` для большей надежности.
    Это позволило находить нужную запись о звонке, даже при незначительных расхождениях в идентификаторах.

## 3. Дублирование задач на перезвон

-   **Проблема:** Если оператор во время одного звонка нажимал "Сохранить" несколько раз, в системе создавалось несколько одинаковых задач на перезвон для одного и того же вызова.
-   **Причина:** Функция `saveAppeal` в `src/actions/appeals.ts` была спроектирована только для *создания* новых обращений. Каждое нажатие на кнопку "Сохранить" приводило к добавлению новой, уникальной записи в `appeals.json`.
-   **Решение:** Логика `saveAppeal` была полностью переработана для выполнения операции "upsert" (update or insert - обновить или вставить). Теперь функция:
    1.  Проверяет, существует ли уже обращение с таким же `callId`.
    2.  Если **существует**, она **обновляет** существующую запись новыми данными.
    3.  Если **не существует**, она **создает** новую запись.
    Это гарантирует, что для одного звонка всегда будет существовать только одна карточка обращения, что исключает дублирование задач.
