# Postgrest Docker

A docker-compose config based upon [cloudflare's example](https://github.com/cloudflare/postgres-postgrest-cloudflared-example).
This is to provide the backend datastore for messages for the proxy. This is not required for the service to run.

## Setup

### Setting up config

Copy and rename `create-tables.example.sql` to `create-tables.sql` and replace "password" with the password for the auth role.

Copy and rename `start.example.sh` to `start.sh` and fill the variables. `AUTH_PASSWORD` **must** be the same password as above.  

### Setting up cloudflared

Create a cloudflared tunnel https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/create-tunnel

Copy the related config, pem file and json config to the ./cloudflare directory

### Starting the service

```sh
$ ./start.sh
```

Note: You may have to change permissions on `start.sh`:

```sh
$ sudo chmod +x start.sh
```

### Setting up the tables

```sh
$ docker-compose exec postgres psql -U user -d db -f /scripts/create-tables.sql 
```

Then tear down the containers and restart them (this is to populate with the correct credentials)

```sh
$ docker-compose down
$ ./start.sh
```

## License

This project (interaction-proxy) is licensed under MIT to anothercat, the contents of this directory are based off the github repo linked above and the original license is included in `SOURCE_LICENSE`
