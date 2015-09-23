﻿--DROP SCHEMA logging CASCADE;
CREATE SCHEMA logging AUTHORIZATION osmchangesetmetadata;

CREATE TABLE logging.sequence (sequence text);
INSERT INTO logging.sequence (sequence) values ('000521300');

CREATE TABLE logging.changesets (
  changeset_id int PRIMARY KEY,
  username text,
  uid int,
  closed_at timestamp,
  num_changes int,
  comment text,
  tag text
);