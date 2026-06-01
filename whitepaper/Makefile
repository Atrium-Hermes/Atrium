.PHONY: pdf clean diagrams

pdf:
	./build.sh

clean:
	rm -rf build atrium-whitepaper.pdf

# Render diagrams only (handy while iterating on .mmd sources)
diagrams:
	@mkdir -p build
	@for f in diagrams/*.mmd; do \
		name=$$(basename $${f%.mmd}); \
		echo "rendering $$name"; \
		mmdc -i $$f -o build/$$name.pdf -b transparent; \
	done
