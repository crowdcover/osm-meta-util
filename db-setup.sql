﻿--DROP SCHEMA logging CASCADE;
CREATE SCHEMA logging AUTHORIZATION osmstats;

CREATE TABLE logging.sequence (sequence text);
INSERT INTO logging.sequence (sequence) values ('001337000');

CREATE TABLE logging.changesets (
  changeset_id int PRIMARY KEY,
  username text,
  uid int,
  closed_at timestamp,
  num_changes int,
  comment text,
  tag text
);
