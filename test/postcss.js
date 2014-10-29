var postcss = require('../lib/postcss');
var Result  = require('../lib/result');
var Root    = require('../lib/root');
var Promise = require('bluebird');
var should  = require('should');

describe('postcss.root()', () => {

    it('allows to build own CSS', () => {
        var root = postcss.root();
        var rule = postcss.rule({ selector: 'a' });
        rule.append( postcss.decl({ prop: 'color', value: 'black' }) );
        root.append( rule );

        root.toString().should.eql("a {\n    color: black\n}");
    });

});

describe('postcss()', () => {

    it('creates processors list', () => {
        postcss().should.eql({ processors: [] });
    });

    it('saves processors list', () => {
        var a = () => 1;
        var b = () => 2;
        postcss(a, b).should.eql({ processors: [a, b] });
    });

    it('saves processors object list', () => {
        var a = () => 1;
        postcss({ postcss: a }).should.eql({ processors: [a] });
    });

    describe('use()', () => {

        it('adds new processors', () => {
            var a = () => 1;
            var processor = postcss();
            processor.use(a);
            processor.should.eql({ processors: [a] });
        });

        it('adds new processor by object', () => {
            var a = () => 1;
            var processor = postcss();
            processor.use({ postcss: a });
            processor.should.eql({ processors: [a] });
        });

        it('adds new processor by object-function', () => {
            var a   = () => 1;
            var obj = () => 2;
            obj.postcss = a;
            var processor = postcss();
            processor.use(obj);
            processor.should.eql({ processors: [a] });
        });

        it('returns itself', () => {
            var a = () => 1;
            var b = () => 2;
            postcss().use(a).use(b).should.eql({ processors: [a, b] });
        });

    });

    describe('process()', () => {
        before( () => {
            this.processor = postcss( (css) => {
                css.eachRule( (rule) => {
                    if ( !rule.selector.match(/::(before|after)/) ) return;
                    if ( !rule.some( i => i.prop == 'content' ) ) {
                        rule.prepend({ prop: 'content', value: '""' });
                    }
                });
            });
        });

        it('processes CSS', () => {
            var result = this.processor.process('a::before{top:0}');
            result.css.should.eql('a::before{content:"";top:0}');
        });

        it('processes parsed AST', () => {
            var root   = postcss.parse('a::before{top:0}');
            var result = this.processor.process(root);
            result.css.should.eql('a::before{content:"";top:0}');
        });

        it('processes previous result', () => {
            var empty  = postcss( (css) => css );
            var result = empty.process('a::before{top:0}');
            result = this.processor.process(result);
            result.css.should.eql('a::before{content:"";top:0}');
        });

        it('throws with file name', () => {
            var error;
            try {
                postcss().process('a {', { from: 'A' });
            } catch (e) {
                error = e;
            }

            error.file.should.eql('A');
            error.message.should.eql('A:1:1: Unclosed block');
        });

        it('allows to replace Root', () => {
            var processor = postcss( () => new Root() );
            processor.process('a {}').css.should.eql('');
        });

        it('returns Result object', () => {
            var result = postcss().process('a{}');
            result.should.be.an.instanceOf(Result);
            result.css.should.eql('a{}');
            result.toString().should.eql('a{}');
        });

        it('calls all processors', () => {
            var calls = '';
            var a = () => calls += 'a';
            var b = () => calls += 'b';

            postcss(a, b).process('');
            calls.should.eql('ab');
        });

        it('parses, convert and stringify CSS', () => {
            var a = (css) => css.should.be.an.instanceof(Root);
            postcss(a).process('a {}').css.should.have.type('string');
        });

        it('send options to processors', () => {
            var a = (css, opts) => opts.should.eql({ from: 'a.css' });
            postcss(a).process('a {}', { from: 'a.css' });
        });

    });

    describe('async()', () => {
        before( () => {
            this.processor = postcss( (css, opts, done) => {
                css.eachRule( (rule) => {
                    if ( !rule.selector.match(/::(before|after)/) ) return;
                    if ( !rule.some( i => i.prop == 'content' ) ) {
                        rule.prepend({ prop: 'content', value: '""' });
                    }
                });
                setTimeout(done, 00);
            });
        });

        should.Assertion.add('eventuallyEql', function(str, done) {
            this.obj.then(function(result) {
                result.css.should.eql(str);
                done();
            }).catch(function(error) {
                done(error);
            });
        });

        function eventually(result) {
            return Promise.resolve(result.css);
        }

        it('processes CSS', (cb) => {
            var result = this.processor.async('a::before{top:0}');
            result.should.eventuallyEql('a::before{content:"";top:0}', cb);
        });

        it('processes parsed AST', (cb) => {
            var root   = postcss.parse('a::before{top:0}');
            var result = this.processor.async(root);
            result.should.eventuallyEql('a::before{content:"";top:0}', cb);
        });

        it('processes previous result', (cb) => {
            var empty  = postcss( (css) => css );
            var result = empty.process('a::before{top:0}');
            result = this.processor.async(result);
            result.should.eventuallyEql('a::before{content:"";top:0}', cb);
        });

        it('throws with file name', (cb) => {
            postcss().async('a {', { from: 'A' }).catch(function(error) {
                try {
                    error.file.should.eql('A');
                    error.message.should.eql('A:1:1: Unclosed block');
                    cb();
                } catch(e) {
                    cb(e);
                }
            });

        });

        it('allows to replace Root', (cb) => {
            var processor = postcss( () => new Root() );
            processor.async('a {}').should.eventuallyEql('', cb);
        });

        it('returns Result object', (cb) => {
            var result = postcss().async('a{}').then((result) => {
                result.should.be.an.instanceOf(Result);
                result.css.should.eql('a{}');
                result.toString().should.eql('a{}');
                cb();
            }).catch(error => cb(error));
        });

        it('calls all processors', (cb) => {
            var calls = '';
            var a = () => calls += 'a';
            var b = () => calls += 'b';

            postcss(a, b).async('')
                .then( () => calls.should.eql('ab'))
                .then(cb.bind(null, null))
                .catch(error => cb(error));
        });

        it('parses, convert and stringify CSS', (cb) => {
            var a = (css) => css.should.be.an.instanceof(Root);
            postcss(a).async('a {}').then(result => {
                result.css.should.have.type('string');
            }).then(cb.bind(null, null)).catch(cb);
        });

        it('send options to processors', (cb) => {
            var a = (css, opts) => opts.should.eql({ from: 'a.css' });
            postcss(a).async('a {}', { from: 'a.css' })
                .then(cb.bind(null, null)).catch(cb);
        });

    });

});
