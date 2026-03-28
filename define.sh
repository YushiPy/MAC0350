function run-server {
	uvicorn --reload "$1":app
}