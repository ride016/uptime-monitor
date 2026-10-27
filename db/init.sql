CREATE TABLE IF NOT EXISTS monitors (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    url        VARCHAR(500) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checks (
    id          BIGSERIAL PRIMARY KEY,
    monitor_id  INT         NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status      VARCHAR(10) NOT NULL CHECK (status IN ('up', 'slow', 'down')),
    status_code INT,
    response_ms INT,
    error       TEXT,
    checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checks_monitor_time
    ON checks (monitor_id, checked_at DESC);

INSERT INTO monitors (name, url) VALUES
    ('GitHub', 'https://github.com'),
    ('Google', 'https://www.google.com'),
    ('Layanan Contoh (Gangguan)', 'https://tidak-ada.invalid')
ON CONFLICT (url) DO NOTHING;